import { Injectable, Logger } from '@nestjs/common';
import { newId } from '@vop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { BlindIndexService } from '../crypto/blind-index.service';

export type VerificationKind = 'pan' | 'gst' | 'bank' | 'msme';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The current IST calendar day plus the UTC instant it ends (next IST midnight). */
function istDay(now = new Date()): { day: string; expiresAt: Date } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const day = ist.toISOString().slice(0, 10); // YYYY-MM-DD in IST
  const nextMidnightUtc =
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1, 0, 0, 0) -
    IST_OFFSET_MS;
  return { day, expiresAt: new Date(nextMidnightUtc) };
}

/**
 * A same-day, scoped cache for third-party verification responses, so an unchanged PAN/GST/bank
 * value is only looked up once per day per requester (or case). Cuts external API cost and latency.
 *
 * Security (ADR-0006): the cached payload is envelope-encrypted at rest; the identifier is stored
 * only as a blind-index HMAC (never plaintext/ciphertext of the PAN/GSTIN/account); entries are
 * scoped per requester/case so one user's cached PII can't be served to another, and they expire
 * at the end of the IST day.
 */
@Injectable()
export class VerificationCacheService {
  private readonly logger = new Logger(VerificationCacheService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
    private readonly blind: BlindIndexService,
  ) {}

  /** Return the cached result for this scope/kind/identifier if present and unexpired, else null. */
  async get<T>(scope: string, kind: VerificationKind, identifier: string): Promise<T | null> {
    const keyHash = this.blind.index(identifier);
    const { day } = istDay();
    try {
      const row = await this.prisma.verificationCache.findUnique({
        where: { scope_kind_keyHash_day: { scope, kind, keyHash, day } },
      });
      if (!row) return null;
      if (row.expiresAt.getTime() <= Date.now()) {
        await this.prisma.verificationCache
          .delete({ where: { id: row.id } })
          .catch(() => undefined);
        return null;
      }
      return JSON.parse(await this.crypto.decryptFromString(row.payloadEnc)) as T;
    } catch (err) {
      // A cache miss must never break verification — fall through to a live call.
      this.logger.warn(`Cache read failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Store a result for the current day, encrypted. Best-effort — failures never block the caller. */
  async set<T>(
    scope: string,
    kind: VerificationKind,
    identifier: string,
    payload: T,
  ): Promise<void> {
    const keyHash = this.blind.index(identifier);
    const { day, expiresAt } = istDay();
    try {
      const payloadEnc = await this.crypto.encryptToString(JSON.stringify(payload));
      await this.prisma.verificationCache.upsert({
        where: { scope_kind_keyHash_day: { scope, kind, keyHash, day } },
        create: { id: newId(), scope, kind, keyHash, day, payloadEnc, expiresAt },
        update: { payloadEnc, expiresAt },
      });
    } catch (err) {
      this.logger.warn(`Cache write failed: ${(err as Error).message}`);
    }
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId, redact } from '@vop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { currentContext } from '../common/context';
import {
  GENESIS_HASH,
  computeRowHash,
  verifyChain,
  type AuditPayload,
  type ChainRow,
  type ChainVerification,
} from './audit-hash';

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'DENIED';

export interface AuditInput {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  outcome?: AuditOutcome;
  /** Business detail / before-after diff. Redacted before storage. */
  detail?: unknown;
  actorId?: string | null;
  actorRole?: string | null;
}

// Advisory-lock key that serialises appends so the hash chain has no races.
const CHAIN_LOCK = 4242;

/**
 * Writes the append-only, hash-chained audit trail (ADR-0005). Every sensitive action calls
 * {@link append}. Appends are serialised with a transaction-scoped Postgres advisory lock so two
 * concurrent writers cannot fork the chain.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: AuditInput): Promise<{ id: string; rowHash: string }> {
    const ctx = currentContext();
    const id = newId();
    const at = new Date().toISOString();

    const payload: AuditPayload = {
      id,
      at,
      actorId: input.actorId ?? ctx?.userId ?? null,
      actorRole: input.actorRole ?? ctx?.role ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      outcome: input.outcome ?? 'SUCCESS',
      detail: input.detail === undefined ? null : redact(input.detail),
      correlationId: ctx?.correlationId ?? null,
    };

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAIN_LOCK})`;
      const last = await tx.auditLog.findFirst({
        orderBy: { seq: 'desc' },
        select: { rowHash: true },
      });
      const prevHash = last?.rowHash ?? GENESIS_HASH;
      const rowHash = computeRowHash(payload, prevHash);

      const detailData: Prisma.InputJsonValue | typeof Prisma.JsonNull =
        payload.detail === null ? Prisma.JsonNull : (payload.detail as Prisma.InputJsonValue);

      await tx.auditLog.create({
        data: {
          id,
          at: new Date(at),
          actorId: payload.actorId,
          actorRole: payload.actorRole,
          ip: ctx?.ip ?? null,
          userAgent: ctx?.userAgent ?? null,
          action: payload.action,
          entityType: payload.entityType,
          entityId: payload.entityId,
          outcome: payload.outcome as AuditOutcome,
          detail: detailData,
          correlationId: payload.correlationId,
          prevHash,
          rowHash,
        },
      });
      return { id, rowHash };
    });
  }

  /** Recompute and verify the whole chain. Auditor-facing integrity check (ADR-0005). */
  async verify(): Promise<ChainVerification> {
    const rows = await this.prisma.auditLog.findMany({ orderBy: { seq: 'asc' } });
    const chain: ChainRow[] = rows.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      actorId: r.actorId,
      actorRole: r.actorRole,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      outcome: r.outcome,
      detail: r.detail ?? null,
      correlationId: r.correlationId,
      prevHash: r.prevHash,
      rowHash: r.rowHash,
    }));
    return verifyChain(chain);
  }
}

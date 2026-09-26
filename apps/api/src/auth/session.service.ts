import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import type { AppConfig } from '@vop/config';
import { newId } from '@vop/shared';
import { APP_CONFIG } from '../config/config.module';
import { PrismaService } from '../prisma/prisma.service';

export interface ValidatedSession {
  sessionId: string;
  userId: string;
}

const hashToken = (raw: string): string => createHash('sha256').update(raw).digest('hex');

/**
 * Server-side session store (ADR/OWASP session mgmt). Sessions live in the DB keyed by a hash of
 * an opaque random token; the raw token is only ever in the httpOnly cookie. Enforces idle and
 * absolute timeouts with sliding renewal, and supports revocation on logout / role change /
 * deactivation.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  get cookieName(): string {
    return this.config.session.cookieName;
  }

  /** Create a session for a user; returns the raw token to place in the cookie. */
  async issue(userId: string, ip?: string, userAgent?: string): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    const now = Date.now();
    const idleMs = this.config.session.idleMinutes * 60_000;
    const absMs = this.config.session.absoluteHours * 3_600_000;
    await this.prisma.session.create({
      data: {
        id: newId(),
        userId,
        tokenHash: hashToken(raw),
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        idleExpiresAt: new Date(now + idleMs),
        absoluteExpiresAt: new Date(now + absMs),
      },
    });
    return raw;
  }

  /**
   * Validate a raw session token: not revoked, within idle and absolute windows. On success,
   * slides the idle window forward (capped by the absolute expiry). Returns null when invalid.
   */
  async authenticate(raw: string): Promise<ValidatedSession | null> {
    const session = await this.prisma.session.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (!session || session.revokedAt) return null;

    const now = new Date();
    if (now >= session.idleExpiresAt || now >= session.absoluteExpiresAt) return null;

    const idleMs = this.config.session.idleMinutes * 60_000;
    const nextIdle = new Date(
      Math.min(now.getTime() + idleMs, session.absoluteExpiresAt.getTime()),
    );
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now, idleExpiresAt: nextIdle },
    });
    return { sessionId: session.id, userId: session.userId };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke every live session for a user (logout-everywhere / role change / deactivation). */
  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  setCookie(res: Response, raw: string): void {
    res.cookie(this.cookieName, raw, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.session.cookieSecure,
      path: '/',
      maxAge: this.config.session.absoluteHours * 3_600_000,
    });
  }

  clearCookie(res: Response): void {
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.session.cookieSecure,
      path: '/',
    });
  }
}

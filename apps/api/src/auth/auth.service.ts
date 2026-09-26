import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AppConfig } from '@vop/config';
import { UserStatus } from '@vop/shared';
import { APP_CONFIG } from '../config/config.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { JitService, type NormalisedClaims } from './jit.service';
import { RegistrationService } from '../registration/registration.service';

const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;

export interface LoginResult {
  token: string;
  userId: string;
  mustChangePassword: boolean;
}

export type SsoResult =
  { status: 'active'; token: string; userId: string } | { status: 'pending'; userId: string };

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly jit: JitService,
    private readonly registration: RegistrationService,
  ) {}

  /** Local break-glass login (disabled by default). Generic errors; lockout after repeated fails. */
  async localLogin(
    email: string,
    password: string,
    ip?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    if (!this.config.identity.localLoginEnabled) {
      throw new ForbiddenException('Local login is disabled. Use single sign-on.');
    }
    const invalid = new UnauthorizedException('Invalid credentials.');
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.pwHash || !user.pwSalt) {
      await this.audit.append({ action: 'auth.login', outcome: 'FAILURE', detail: { email } });
      throw invalid;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.append({
        action: 'auth.login',
        outcome: 'DENIED',
        actorId: user.id,
        detail: { reason: 'locked' },
      });
      throw new ForbiddenException('Account temporarily locked. Try again later.');
    }
    if (user.status !== UserStatus.Active) {
      await this.audit.append({ action: 'auth.login', outcome: 'DENIED', actorId: user.id });
      throw invalid;
    }

    const ok = await this.passwords.verify(password, user.pwSalt, user.pwHash);
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      const lockedUntil =
        failed >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: failed, lockedUntil },
      });
      await this.audit.append({
        action: 'auth.login',
        outcome: 'FAILURE',
        actorId: user.id,
        detail: { failedCount: failed, locked: Boolean(lockedUntil) },
      });
      throw invalid;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const token = await this.sessions.issue(user.id, ip, userAgent);
    await this.audit.append({
      action: 'auth.login',
      outcome: 'SUCCESS',
      actorId: user.id,
      detail: { method: 'LOCAL' },
    });
    return { token, userId: user.id, mustChangePassword: user.mustChangePassword };
  }

  /** Complete an SSO login: JIT-provision, then either start a session or route to approval. */
  async completeSso(
    claims: NormalisedClaims,
    authMethod: 'OIDC' | 'SAML',
    idpConfigId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<SsoResult> {
    const rules = await this.prisma.claimRoleMapping.findMany({ where: { idpConfigId } });
    const jit = await this.jit.provisionFromClaims(claims, authMethod, rules);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: jit.userId } });

    if (user.status === UserStatus.Deactivated || user.status === UserStatus.Suspended) {
      await this.audit.append({ action: 'auth.sso', outcome: 'DENIED', actorId: user.id });
      throw new ForbiddenException('Account is not active.');
    }

    if (jit.created) {
      await this.registration.createFromJit(user.id, jit.mappedRoleKeys, {
        department: claims.department,
        designation: claims.designation,
      });
    }

    if (user.status === UserStatus.PendingApproval) {
      await this.audit.append({
        action: 'auth.sso',
        outcome: 'SUCCESS',
        actorId: user.id,
        detail: { method: authMethod, result: 'pending_approval', created: jit.created },
      });
      return { status: 'pending', userId: user.id };
    }

    const token = await this.sessions.issue(user.id, ip, userAgent);
    await this.audit.append({
      action: 'auth.sso',
      outcome: 'SUCCESS',
      actorId: user.id,
      detail: { method: authMethod, result: 'active' },
    });
    return { status: 'active', token, userId: user.id };
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
    await this.audit.append({ action: 'auth.logout', outcome: 'SUCCESS', actorId: userId });
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { jwtVerify, type JWTPayload } from 'jose';
import { AuthMethod, UserStatus, newId } from '@vop/shared';
import type { AppConfig } from '@vop/config';
import { APP_CONFIG } from '../config/config.module';
import { PrismaService } from '../prisma/prisma.service';

interface SupabaseClaims extends JWTPayload {
  email?: string;
  user_metadata?: { name?: string; full_name?: string };
}

/**
 * Supabase authentication bridge. Verifies a Supabase-issued access token (HS256, signed with the
 * project JWT secret) and maps the Supabase identity to a local app user — the user that carries
 * roles/permissions. Authorization stays entirely app-side (deny-by-default RBAC); Supabase only
 * proves *who* the caller is. First login for a known email links the account; an unknown email is
 * JIT-provisioned as PENDING_APPROVAL, preserving the manager-approval model.
 */
@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);
  private readonly secret?: Uint8Array;
  private readonly baseUrl?: string;
  private readonly issuer?: string;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {
    const { jwtSecret, url } = this.config.auth.supabase;
    if (jwtSecret) this.secret = new TextEncoder().encode(jwtSecret);
    if (url) {
      this.baseUrl = url.replace(/\/$/, '');
      this.issuer = `${this.baseUrl}/auth/v1`;
    }
  }

  /** Verify a bearer token and resolve the local user id. Returns null on any failure. */
  async verifyAndResolve(token: string): Promise<{ userId: string; sessionId: string } | null> {
    // Prefer fast local HS256 verification when the project JWT secret is configured;
    // otherwise verify remotely against Supabase's /auth/v1/user endpoint (anon key only).
    const claims = this.secret ? await this.verifyLocal(token) : await this.verifyRemote(token);
    if (!claims) return null;

    const sub = typeof claims.sub === 'string' ? claims.sub : undefined;
    const email = claims.email?.toLowerCase();
    if (!sub || !email) return null;

    const userId = await this.resolveUser(sub, email, claims);
    if (!userId) return null;
    // The token's unique id (jti) or subject identifies the session for audit/logging.
    return { userId, sessionId: (claims.jti as string) ?? sub };
  }

  /** Local HS256 verification with the project JWT secret. */
  private async verifyLocal(token: string): Promise<SupabaseClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret!, {
        issuer: this.issuer,
        audience: 'authenticated',
      });
      return payload as SupabaseClaims;
    } catch (err) {
      this.logger.debug(`Supabase token rejected (local): ${(err as Error).message}`);
      return null;
    }
  }

  /** Remote verification: ask Supabase GoTrue to validate the token and return the user. */
  private async verifyRemote(token: string): Promise<SupabaseClaims | null> {
    const anon = this.config.auth.supabase.anonKey;
    if (!this.baseUrl || !anon) return null;
    try {
      const res = await fetch(`${this.baseUrl}/auth/v1/user`, {
        headers: { apikey: anon, Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const user = (await res.json()) as {
        id?: string;
        email?: string;
        user_metadata?: SupabaseClaims['user_metadata'];
      };
      if (!user.id) return null;
      return { sub: user.id, email: user.email, user_metadata: user.user_metadata };
    } catch (err) {
      this.logger.debug(`Supabase token rejected (remote): ${(err as Error).message}`);
      return null;
    }
  }

  private async resolveUser(
    sub: string,
    email: string,
    claims: SupabaseClaims,
  ): Promise<string | null> {
    // 1) Already linked by Supabase id.
    const linked = await this.prisma.user.findUnique({ where: { supabaseUserId: sub } });
    if (linked) return linked.id;

    // 2) Known email — link the Supabase id to the existing app user on first login.
    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      await this.prisma.user.update({
        where: { id: byEmail.id },
        data: { supabaseUserId: sub, authMethod: AuthMethod.Supabase, lastLoginAt: new Date() },
      });
      return byEmail.id;
    }

    // 3) Unknown — JIT provision, pending manager approval (no roles granted).
    const name =
      claims.user_metadata?.name ?? claims.user_metadata?.full_name ?? email.split('@')[0] ?? email;
    const created = await this.prisma.user.create({
      data: {
        id: newId(),
        email,
        name,
        status: UserStatus.PendingApproval,
        authMethod: AuthMethod.Supabase,
        supabaseUserId: sub,
        lastLoginAt: new Date(),
      },
    });
    this.logger.log(`JIT-provisioned Supabase user ${email} (pending approval)`);
    return created.id;
  }
}

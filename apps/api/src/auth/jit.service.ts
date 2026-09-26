import { Injectable } from '@nestjs/common';
import { newId } from '@vop/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Normalised claims extracted from an OIDC token or SAML assertion (via IdP claim mappings). */
export interface NormalisedClaims {
  subject: string;
  email: string;
  name: string;
  groups?: string[];
  manager?: string; // manager's email
  employeeId?: string;
  department?: string;
  designation?: string;
}

export interface ClaimRoleRule {
  claimType: string; // e.g. "group"
  claimValue: string;
  roleKey: string;
}

/** Pure mapping of IdP group claims to application role keys (admin-configurable table). */
export function mapClaimsToRoles(
  groups: readonly string[],
  rules: readonly ClaimRoleRule[],
): string[] {
  const set = new Set<string>();
  for (const rule of rules) {
    if (rule.claimType === 'group' && groups.includes(rule.claimValue)) set.add(rule.roleKey);
  }
  return [...set];
}

export interface JitResult {
  userId: string;
  created: boolean;
  status: string;
  /** Roles suggested by the IdP claim mapping — used to seed the access request for a new user. */
  mappedRoleKeys: string[];
}

/**
 * Just-in-time provisioning on first SSO login. A new user is created in PENDING_APPROVAL with no
 * effective roles (SSO authenticates identity, not authorization); the claim-mapped roles are
 * returned so the caller can seed a manager-approval request. Existing users are matched by IdP
 * subject (then email) and have their last-login stamped. (ADR-0002 / prompt §2.1.)
 */
@Injectable()
export class JitService {
  constructor(private readonly prisma: PrismaService) {}

  async provisionFromClaims(
    claims: NormalisedClaims,
    authMethod: 'OIDC' | 'SAML',
    rules: readonly ClaimRoleRule[],
  ): Promise<JitResult> {
    const mappedRoleKeys = mapClaimsToRoles(claims.groups ?? [], rules);

    const existing =
      (await this.prisma.user.findFirst({ where: { externalSubject: claims.subject } })) ??
      (await this.prisma.user.findUnique({ where: { email: claims.email } }));

    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          lastLoginAt: new Date(),
          externalSubject: existing.externalSubject ?? claims.subject,
        },
      });
      return {
        userId: existing.id,
        created: false,
        status: existing.status,
        mappedRoleKeys,
      };
    }

    const manager = claims.manager
      ? await this.prisma.user.findUnique({ where: { email: claims.manager } })
      : null;

    const created = await this.prisma.user.create({
      data: {
        id: newId(),
        email: claims.email,
        name: claims.name,
        status: 'PENDING_APPROVAL',
        authMethod,
        externalSubject: claims.subject,
        employeeId: claims.employeeId ?? null,
        department: claims.department ?? null,
        designation: claims.designation ?? null,
        managerId: manager?.id ?? null,
        lastLoginAt: new Date(),
      },
    });

    return { userId: created.id, created: true, status: created.status, mappedRoleKeys };
  }
}

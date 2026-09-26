import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SAML, type SamlConfig } from '@node-saml/node-saml';
import type { AppConfig } from '@vop/config';
import { APP_CONFIG } from '../config/config.module';
import type { NormalisedClaims } from './jit.service';
import type { ClaimMapping } from './oidc.service';

/** Map a SAML assertion profile (nameID + attributes) to normalised claims. */
export function extractSamlProfile(
  profile: Record<string, unknown>,
  mapping: ClaimMapping,
): NormalisedClaims {
  const get = (logical: string, fallback: string): unknown => profile[mapping[logical] ?? fallback];
  const groupsRaw = get('groups', 'groups');
  const email = String(get('email', 'email') ?? profile['nameID'] ?? '');
  return {
    subject: String(profile['nameID'] ?? get('subject', 'subject') ?? email),
    email,
    name: String(get('name', 'displayName') ?? email),
    groups: Array.isArray(groupsRaw) ? groupsRaw.map(String) : groupsRaw ? [String(groupsRaw)] : [],
    manager: get('manager', 'manager') ? String(get('manager', 'manager')) : undefined,
    employeeId: get('employeeId', 'employeeId')
      ? String(get('employeeId', 'employeeId'))
      : undefined,
    department: get('department', 'department')
      ? String(get('department', 'department'))
      : undefined,
    designation: get('designation', 'title') ? String(get('designation', 'title')) : undefined,
  };
}

/**
 * SAML 2.0 support via @node-saml/node-saml, for clients on ADFS or other SAML IdPs. Enabled per
 * deployment (config-driven). Same JIT provisioning path as OIDC once the assertion is validated.
 */
@Injectable()
export class SamlService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  isEnabled(): boolean {
    const s = this.config.identity.saml;
    return Boolean(s.enabled && s.entryPoint && s.cert);
  }

  private instance(): SAML {
    const s = this.config.identity.saml;
    if (!this.isEnabled()) throw new InternalServerErrorException('SAML is not enabled.');
    const options: SamlConfig = {
      callbackUrl: `${this.config.api.url}/api/v1/auth/saml/callback`,
      entryPoint: s.entryPoint!,
      issuer: s.issuer ?? 'vop',
      idpCert: s.cert!,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
    };
    return new SAML(options);
  }

  getAuthorizeUrl(relayState: string): Promise<string> {
    return this.instance().getAuthorizeUrlAsync(relayState, undefined, {});
  }

  async consumeResponse(body: Record<string, string>): Promise<NormalisedClaims> {
    const { profile } = await this.instance().validatePostResponseAsync(body);
    return extractSamlProfile((profile ?? {}) as Record<string, unknown>, {});
  }
}

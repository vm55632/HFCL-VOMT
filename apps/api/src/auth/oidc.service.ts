import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Issuer, generators, type Client, type TokenSet } from 'openid-client';
import type { AppConfig } from '@vop/config';
import { APP_CONFIG } from '../config/config.module';
import type { NormalisedClaims } from './jit.service';

export type ClaimMapping = Record<string, string>;

/** Map raw ID-token/userinfo claims to normalised claims using the IdP's configurable mapping. */
export function extractClaims(
  raw: Record<string, unknown>,
  mapping: ClaimMapping,
): NormalisedClaims {
  const get = (logical: string, fallback: string): unknown => raw[mapping[logical] ?? fallback];
  const groupsRaw = get('groups', 'groups');
  return {
    subject: String(get('subject', 'sub') ?? ''),
    email: String(get('email', 'email') ?? ''),
    name: String(get('name', 'name') ?? get('email', 'email') ?? ''),
    groups: Array.isArray(groupsRaw) ? groupsRaw.map(String) : [],
    manager: get('manager', 'manager') ? String(get('manager', 'manager')) : undefined,
    employeeId: get('employeeId', 'employee_id')
      ? String(get('employeeId', 'employee_id'))
      : undefined,
    department: get('department', 'department')
      ? String(get('department', 'department'))
      : undefined,
    designation: get('designation', 'title') ? String(get('designation', 'title')) : undefined,
  };
}

export interface OidcAuthRequest {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

/**
 * OIDC (Authorization Code + PKCE) via openid-client. Entra ID in production; Keycloak brokers it
 * in dev. Issuer metadata is discovered lazily and cached. The callback validates state/nonce and
 * returns the raw claims for {@link extractClaims} + JIT provisioning. (prompt §2.1.)
 */
@Injectable()
export class OidcService {
  private client?: Client;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  isConfigured(): boolean {
    const o = this.config.identity.oidc;
    return Boolean(o.issuer && o.clientId && o.redirectUri);
  }

  private async getClient(): Promise<Client> {
    if (this.client) return this.client;
    const o = this.config.identity.oidc;
    if (!this.isConfigured()) {
      throw new InternalServerErrorException('OIDC is not configured.');
    }
    const issuer = await Issuer.discover(o.issuer!);
    this.client = new issuer.Client({
      client_id: o.clientId!,
      client_secret: o.clientSecret,
      redirect_uris: [o.redirectUri!],
      response_types: ['code'],
    });
    return this.client;
  }

  async createAuthRequest(): Promise<OidcAuthRequest> {
    const client = await this.getClient();
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const url = client.authorizationUrl({
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return { url, state, nonce, codeVerifier };
  }

  async handleCallback(
    params: Record<string, string>,
    checks: { state: string; nonce: string; codeVerifier: string },
    mapping: ClaimMapping = {},
  ): Promise<NormalisedClaims> {
    const client = await this.getClient();
    const tokenSet: TokenSet = await client.callback(
      this.config.identity.oidc.redirectUri!,
      params,
      {
        state: checks.state,
        nonce: checks.nonce,
        code_verifier: checks.codeVerifier,
      },
    );
    const raw = tokenSet.claims() as unknown as Record<string, unknown>;
    return extractClaims(raw, mapping);
  }
}

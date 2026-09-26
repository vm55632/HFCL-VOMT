import type { AppConfig } from '@vop/config';
import type { SecretsProvider } from './contracts';

/** Dev-only: resolves secrets from the process environment. Forbidden in production (ADR-0004). */
export class EnvSecretsProvider implements SecretsProvider {
  get(name: string): Promise<string | undefined> {
    return Promise.resolve(process.env[name]);
  }
}

/**
 * HashiCorp Vault (KV v2) over its HTTP API — no SDK, uses fetch. Reads `secret/data/<name>` and
 * returns the `value` field. On-prem secrets backend.
 */
export class VaultSecretsProvider implements SecretsProvider {
  private readonly addr: string;
  private readonly token: string;

  constructor(config: AppConfig) {
    if (!config.vault.addr || !config.vault.token) {
      throw new Error('VaultSecretsProvider requires VOP_VAULT_ADDR and VOP_VAULT_TOKEN.');
    }
    this.addr = config.vault.addr.replace(/\/+$/, '');
    this.token = config.vault.token;
  }

  async get(name: string): Promise<string | undefined> {
    const res = await fetch(`${this.addr}/v1/secret/data/${encodeURIComponent(name)}`, {
      headers: { 'X-Vault-Token': this.token },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`Vault read failed (${res.status}).`);
    const body = (await res.json()) as { data?: { data?: Record<string, string> } };
    return body.data?.data?.value;
  }
}

/** Cloud secret managers (Azure KV, AWS SM, GCP SM) — stubbed until the cloud is chosen. */
export class NotImplementedSecrets implements SecretsProvider {
  constructor(private readonly name: string) {}
  get(): Promise<string | undefined> {
    return Promise.reject(new Error(`${this.name} SecretsProvider is not implemented yet (stub).`));
  }
}

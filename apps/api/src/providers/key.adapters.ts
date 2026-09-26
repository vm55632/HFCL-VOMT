import { scryptSync } from 'node:crypto';
import type { AppConfig } from '@vop/config';
import type { ActiveKey, KeyProvider } from './contracts';

/** Base salt for deriving the local KEK from the configured master key. */
const LOCAL_SALT = Buffer.from('vop-field-kek-v1');

/**
 * Dev/on-prem-lite key provider: derives a single 32-byte AES key from VOP_MASTER_KEY.
 * Config validation forbids this driver in production (ADR-0004/0006).
 */
export class LocalKeyProvider implements KeyProvider {
  private readonly keyId = 'local-v1';
  private readonly key: Buffer;

  constructor(config: AppConfig) {
    const master = config.crypto.masterKey;
    if (!master) {
      throw new Error('LocalKeyProvider requires VOP_MASTER_KEY.');
    }
    this.key = scryptSync(master, LOCAL_SALT, 32);
  }

  getActiveKey(): Promise<ActiveKey> {
    return Promise.resolve({ keyId: this.keyId, key: this.key });
  }

  getKey(keyId: string): Promise<Buffer> {
    if (keyId !== this.keyId) {
      return Promise.reject(new Error(`Unknown keyId "${keyId}" for LocalKeyProvider.`));
    }
    return Promise.resolve(this.key);
  }
}

/**
 * Vault Transit / cloud KMS providers wrap DEKs with a managed KEK. Left as marked stubs until
 * the target environment is chosen (Phase 6). Shape exists so call sites don't change.
 */
export class NotImplementedKeyProvider implements KeyProvider {
  constructor(private readonly name: string) {}
  getActiveKey(): Promise<ActiveKey> {
    return Promise.reject(new Error(`${this.name} KeyProvider is not implemented yet (stub).`));
  }
  getKey(): Promise<Buffer> {
    return Promise.reject(new Error(`${this.name} KeyProvider is not implemented yet (stub).`));
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { KEY_PROVIDER, type KeyProvider } from '../providers/contracts';

/** On-disk shape of an encrypted field value. `keyId` enables key rotation (ADR-0006). */
export interface EncryptedField {
  v: 1;
  keyId: string;
  iv: string; // base64
  ct: string; // base64 ciphertext
  tag: string; // base64 GCM auth tag
}

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * Application-level field encryption using envelope keys from the KeyProvider. AES-256-GCM is
 * authenticated, so tampering is detected on decrypt. Used for PAN, bank account and personal
 * identifiers (ADR-0006). Centralised here; call sites never touch crypto primitives.
 */
@Injectable()
export class FieldEncryptionService {
  constructor(@Inject(KEY_PROVIDER) private readonly keys: KeyProvider) {}

  async encrypt(plaintext: string): Promise<EncryptedField> {
    const { keyId, key } = await this.keys.getActiveKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      v: 1,
      keyId,
      iv: iv.toString('base64'),
      ct: ct.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  async decrypt(field: EncryptedField): Promise<string> {
    const key = await this.keys.getKey(field.keyId);
    const decipher = createDecipheriv(ALGO, key, Buffer.from(field.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(field.tag, 'base64'));
    const pt = Buffer.concat([decipher.update(Buffer.from(field.ct, 'base64')), decipher.final()]);
    return pt.toString('utf8');
  }

  /** Encrypt to a compact string suitable for a single DB text column. */
  async encryptToString(plaintext: string): Promise<string> {
    return JSON.stringify(await this.encrypt(plaintext));
  }

  /** Inverse of {@link encryptToString}. Throws if the value was tampered with. */
  async decryptFromString(stored: string): Promise<string> {
    const field = JSON.parse(stored) as EncryptedField;
    return this.decrypt(field);
  }
}

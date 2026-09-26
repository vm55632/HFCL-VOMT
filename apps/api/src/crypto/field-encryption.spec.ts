import { randomBytes } from 'node:crypto';
import { FieldEncryptionService } from './field-encryption.service';
import type { KeyProvider } from '../providers/contracts';

const key = randomBytes(32);
const keys: KeyProvider = {
  getActiveKey: () => Promise.resolve({ keyId: 'test-1', key }),
  getKey: (id) =>
    id === 'test-1' ? Promise.resolve(key) : Promise.reject(new Error('unknown key')),
};

describe('FieldEncryptionService', () => {
  const svc = new FieldEncryptionService(keys);

  it('round-trips a value and never stores the plaintext', async () => {
    const enc = await svc.encrypt('ABCDE1234F');
    expect(Buffer.from(enc.ct, 'base64').toString('utf8')).not.toContain('ABCDE');
    expect(await svc.decrypt(enc)).toBe('ABCDE1234F');
  });

  it('detects tampering via the GCM auth tag', async () => {
    const enc = await svc.encrypt('bank-account-123');
    const tampered = { ...enc, ct: Buffer.from('00112233', 'hex').toString('base64') };
    await expect(svc.decrypt(tampered)).rejects.toThrow();
  });

  it('uses a fresh IV so identical plaintext yields different ciphertext', async () => {
    const a = await svc.encrypt('same');
    const b = await svc.encrypt('same');
    expect(a.iv === b.iv && a.ct === b.ct).toBe(false);
  });

  it('round-trips through the string form used for a DB column', async () => {
    const stored = await svc.encryptToString('personal-id');
    expect(await svc.decryptFromString(stored)).toBe('personal-id');
  });
});

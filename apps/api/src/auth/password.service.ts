import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from 'node:crypto';

const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

/** Promise wrapper over scrypt's options-taking callback overload. */
function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) =>
      err ? reject(err) : resolve(derivedKey),
    );
  });
}

/**
 * Password hashing for local break-glass accounts (scrypt with a per-user salt). Local login is
 * disabled by default and MFA-gated; these accounts are the exception, not the norm (SSO is the
 * rule). Hashes are never returned by any endpoint.
 */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<{ salt: string; hash: string }> {
    const salt = randomBytes(16).toString('hex');
    const derived = (await scryptAsync(password, salt, PARAMS.keylen, PARAMS)) as Buffer;
    return { salt, hash: derived.toString('hex') };
  }

  async verify(password: string, salt: string, hash: string): Promise<boolean> {
    const derived = (await scryptAsync(password, salt, PARAMS.keylen, PARAMS)) as Buffer;
    const expected = Buffer.from(hash, 'hex');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }

  /** Enforce a minimum password policy for local accounts. Returns the first problem, or null. */
  policyError(password: string): string | null {
    if (password.length < 12) return 'Password must be at least 12 characters.';
    if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain a digit.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a symbol.';
    return null;
  }
}

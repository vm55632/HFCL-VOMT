import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '@vop/config';
import { APP_CONFIG } from '../config/config.module';

/**
 * Deterministic blind index for encrypted-but-searchable fields (ADR-0006). Duplicate detection
 * queries this HMAC, never the plaintext or ciphertext. Values are normalised so trivial
 * formatting differences don't defeat equality (e.g. PAN case/spacing).
 */
@Injectable()
export class BlindIndexService {
  private readonly key: Buffer;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const k = config.crypto.blindIndexKey;
    if (!k) throw new Error('BlindIndexService requires VOP_BLIND_INDEX_KEY.');
    this.key = Buffer.from(k);
  }

  /** Normalise an identifier for indexing: trim, uppercase, drop internal whitespace. */
  private normalise(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, '');
  }

  index(value: string): string {
    return createHmac('sha256', this.key).update(this.normalise(value)).digest('hex');
  }

  /** Constant-time comparison of two blind indexes. */
  matches(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }
}

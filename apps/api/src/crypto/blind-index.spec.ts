import type { AppConfig } from '@vop/config';
import { BlindIndexService } from './blind-index.service';

const config = { crypto: { blindIndexKey: 'test-blind-index-key' } } as unknown as AppConfig;

describe('BlindIndexService', () => {
  const svc = new BlindIndexService(config);

  it('is deterministic and normalises case/whitespace', () => {
    expect(svc.index(' abcde1234f ')).toBe(svc.index('ABCDE1234F'));
  });

  it('produces different indexes for different values', () => {
    expect(svc.index('AAACA1234A')).not.toBe(svc.index('AAACA1234B'));
  });

  it('matches indexes in constant time', () => {
    const i = svc.index('value');
    expect(svc.matches(i, svc.index('value'))).toBe(true);
    expect(svc.matches(i, svc.index('other'))).toBe(false);
  });

  it('requires a configured key', () => {
    expect(() => new BlindIndexService({ crypto: {} } as unknown as AppConfig)).toThrow();
  });
});

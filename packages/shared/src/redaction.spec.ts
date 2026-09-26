import { redact, REDACTED } from './redaction';
import { maskPan, maskAccount, maskEmail, maskPhone } from './masking';

describe('redact', () => {
  it('redacts sensitive keys at any depth without mutating the input', () => {
    const input = {
      email: 'a@b.com',
      password: 'hunter2',
      nested: { token: 'abc', accountNo: '123456789', ok: 'keep' },
      list: [{ clientSecret: 'x' }, { fine: 1 }],
    };
    const out = redact(input);
    expect(out.password).toBe(REDACTED);
    expect(out.nested.token).toBe(REDACTED);
    expect(out.nested.accountNo).toBe(REDACTED);
    expect(out.nested.ok).toBe('keep');
    expect(out.list[0]!.clientSecret).toBe(REDACTED);
    // input untouched
    expect(input.password).toBe('hunter2');
  });

  it('matches keys ignoring case and separators', () => {
    const out = redact({ 'Set-Cookie': 'x', API_KEY: 'y', panNumber: 'AAACA1234A' });
    expect(out['Set-Cookie']).toBe(REDACTED);
    expect(out.API_KEY).toBe(REDACTED);
    expect(out.panNumber).toBe(REDACTED);
  });

  it('handles circular references safely', () => {
    const a: Record<string, unknown> = { name: 'x' };
    a.self = a;
    expect(() => redact(a)).not.toThrow();
  });
});

describe('masking', () => {
  it('masks PAN keeping the recognisable tail', () => {
    expect(maskPan('AAACA1234A')).toBe('XXXXX1234A');
  });
  it('masks account numbers to the last 4', () => {
    expect(maskAccount('123456789012')).toBe('••••••••9012');
  });
  it('masks emails', () => {
    expect(maskEmail('john@example.com')).toBe('j••n@example.com');
  });
  it('masks phones to the last 4', () => {
    expect(maskPhone('+91 98765 43210')).toMatch(/3210$/);
  });
});

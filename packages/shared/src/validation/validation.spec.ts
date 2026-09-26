import { validatePan } from './pan';
import { validateGstin, gstinCheckDigit } from './gstin';
import { validateIfsc } from './ifsc';
import { EntityType } from '../types';

// A GSTIN built from a known PAN with a correct check digit, for deterministic tests.
// PAN: AAACA1234A → GSTIN state 27 (Maharashtra), entity 1, Z, computed check digit.
const PAN = 'AAACA1234A';
const gstinBody = `27${PAN}1Z`; // 14 chars once we append the check digit
const GSTIN = gstinBody + gstinCheckDigit(gstinBody);

describe('validatePan', () => {
  it('accepts a well-formed PAN and derives holder type', () => {
    const r = validatePan('aaaca1234a');
    expect(r.valid).toBe(true);
    expect(r.pan).toBe('AAACA1234A');
    expect(r.holderTypeChar).toBe('C');
    expect(r.suggestedEntity).toBe(EntityType.PrivateLimited);
  });

  it('rejects a malformed PAN', () => {
    expect(validatePan('ABC123').valid).toBe(false);
    expect(validatePan('AAACA1234').valid).toBe(false);
  });
});

describe('validateGstin', () => {
  it('accepts a GSTIN with a valid state code, embedded PAN and check digit', () => {
    const r = validateGstin(GSTIN);
    expect(r.valid).toBe(true);
    expect(r.stateCode).toBe('27');
    expect(r.embeddedPan).toBe(PAN);
  });

  it('detects a wrong check digit', () => {
    const bad = GSTIN.slice(0, 14) + (GSTIN.slice(14) === 'A' ? 'B' : 'A');
    const r = validateGstin(bad);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/check digit/i);
  });

  it('cross-checks the embedded PAN against the vendor PAN', () => {
    expect(validateGstin(GSTIN, PAN).panMatches).toBe(true);
    const r = validateGstin(GSTIN, 'ZZZZZ9999Z');
    expect(r.panMatches).toBe(false);
    expect(r.valid).toBe(false);
  });

  it('rejects an invalid state code', () => {
    const badState = '00' + GSTIN.slice(2);
    // recompute the format still matches; state code 00 is invalid
    expect(validateGstin(badState).errors.join(' ')).toMatch(/state code/i);
  });
});

describe('validateIfsc', () => {
  it('accepts a valid IFSC and splits bank/branch', () => {
    const r = validateIfsc('hdfc0001234');
    expect(r.valid).toBe(true);
    expect(r.bankCode).toBe('HDFC');
    expect(r.branchCode).toBe('001234');
  });

  it('rejects an IFSC without the mandatory 0 in position 5', () => {
    expect(validateIfsc('HDFC1001234').valid).toBe(false);
  });
});

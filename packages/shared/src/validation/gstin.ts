import { PAN_RE } from './pan';

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

const BASE36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Valid Indian GST state codes: 01–38, plus 97 (Other Territory), 99 (Centre Jurisdiction).
const VALID_STATE_CODES = new Set<string>([
  ...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, '0')),
  '97',
  '99',
]);

/**
 * GSTIN check digit (mod-36). Standard GSTN algorithm: alternate factors 2,1 from the right,
 * fold each product into base-36, sum, and take the complement mod 36. Computed here so a typo
 * never reaches a paid verification API. (Ported from the prototype.)
 */
export function gstinCheckDigit(first14: string): string {
  let factor = 2;
  let sum = 0;
  for (let i = first14.length - 1; i >= 0; i--) {
    const codePoint = BASE36.indexOf(first14.charAt(i));
    if (codePoint < 0) return '';
    let addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / 36) + (addend % 36);
    sum += addend;
  }
  const check = (36 - (sum % 36)) % 36;
  return BASE36.charAt(check);
}

export interface GstinResult {
  valid: boolean;
  gstin?: string;
  stateCode?: string;
  embeddedPan?: string;
  /** Present when a vendor PAN was supplied to cross-check against the embedded PAN. */
  panMatches?: boolean;
  errors: string[];
}

/**
 * Validate a GSTIN offline: format, state code, embedded-PAN shape, and the mod-36 check digit.
 * When `vendorPan` is given, confirm the GSTIN embeds that exact PAN (positions 3–12).
 */
export function validateGstin(input: string, vendorPan?: string): GstinResult {
  const gstin = (input || '').trim().toUpperCase();
  const errors: string[] = [];

  if (!GSTIN_RE.test(gstin)) {
    errors.push('GSTIN must be 15 characters in the standard format.');
    return { valid: false, errors };
  }

  const stateCode = gstin.slice(0, 2);
  if (!VALID_STATE_CODES.has(stateCode)) {
    errors.push(`GST state code "${stateCode}" is not a valid Indian state code.`);
  }

  const embeddedPan = gstin.slice(2, 12);
  if (!PAN_RE.test(embeddedPan)) {
    errors.push('The PAN embedded in the GSTIN (positions 3–12) is not a valid PAN.');
  }

  const expected = gstinCheckDigit(gstin.slice(0, 14));
  if (expected !== gstin.charAt(14)) {
    errors.push('GSTIN check digit is invalid — the number is mistyped or fabricated.');
  }

  let panMatches: boolean | undefined;
  if (vendorPan) {
    panMatches = embeddedPan === vendorPan.trim().toUpperCase();
    if (!panMatches) {
      errors.push('GSTIN does not belong to the vendor PAN (embedded PAN differs).');
    }
  }

  return {
    valid: errors.length === 0,
    gstin,
    stateCode,
    embeddedPan,
    panMatches,
    errors,
  };
}

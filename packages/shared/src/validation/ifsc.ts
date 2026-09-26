// IFSC: four letters (bank), a mandatory 0, then six alphanumerics (branch).
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export interface IfscResult {
  valid: boolean;
  ifsc?: string;
  bankCode?: string;
  branchCode?: string;
  errors: string[];
}

/** Validate IFSC format offline. Bank/branch names come from a provider lookup (Phase 3+). */
export function validateIfsc(input: string): IfscResult {
  const ifsc = (input || '').trim().toUpperCase();
  const errors: string[] = [];
  if (!IFSC_RE.test(ifsc)) {
    errors.push('IFSC must be four letters, a zero, then six characters (e.g. HDFC0001234).');
    return { valid: false, errors };
  }
  return {
    valid: true,
    ifsc,
    bankCode: ifsc.slice(0, 4),
    branchCode: ifsc.slice(5),
    errors,
  };
}

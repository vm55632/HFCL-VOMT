/**
 * Masking for display. Sensitive values are masked by default in UI, API responses and exports;
 * unmasking is a separate, permissioned, audited action (see ADR-0006). These helpers never throw
 * and return a safe placeholder for empty input.
 */

/** Mask a PAN as `XXXXX1234F` (keep the 4 digits + trailing letter that make it recognisable). */
export function maskPan(pan: string | null | undefined): string {
  const v = (pan ?? '').trim().toUpperCase();
  if (v.length !== 10) return v ? '••••••••••' : '';
  return `XXXXX${v.slice(5)}`;
}

/** Mask a bank account number, revealing only the last `visible` (default 4) digits. */
export function maskAccount(account: string | null | undefined, visible = 4): string {
  const v = (account ?? '').replace(/\s+/g, '');
  if (!v) return '';
  if (v.length <= visible) return '•'.repeat(v.length);
  return '•'.repeat(v.length - visible) + v.slice(-visible);
}

/** Mask an email as `j••••e@example.com`. */
export function maskEmail(email: string | null | undefined): string {
  const v = (email ?? '').trim();
  const at = v.indexOf('@');
  if (at < 1) return v ? '•••' : '';
  const local = v.slice(0, at);
  const domain = v.slice(at);
  if (local.length <= 2) return `${local.charAt(0)}•${domain}`;
  return `${local.charAt(0)}${'•'.repeat(Math.max(1, local.length - 2))}${local.slice(-1)}${domain}`;
}

/** Mask a phone number, revealing only the last `visible` (default 4) digits. */
export function maskPhone(phone: string | null | undefined, visible = 4): string {
  const v = (phone ?? '').replace(/[^\d+]/g, '');
  if (!v) return '';
  const digits = v.replace(/\D/g, '');
  if (digits.length <= visible) return '•'.repeat(digits.length);
  return `${'•'.repeat(digits.length - visible)}${digits.slice(-visible)}`;
}

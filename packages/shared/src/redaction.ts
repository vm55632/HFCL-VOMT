/**
 * Redaction for logs and audit diffs. Replaces the values of sensitive keys with a placeholder
 * before anything is written, so PII and secrets never reach log output. Key-based (case- and
 * separator-insensitive) plus a few value patterns. Depth- and cycle-safe.
 *
 * A test asserts that known secret/PII keys are redacted (Definition of Done / ADR-0004).
 */

export const REDACTED = '[REDACTED]';

/** Default sensitive key fragments — matched case-insensitively, ignoring separators. */
export const DEFAULT_SENSITIVE_KEYS: readonly string[] = [
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'setcookie',
  'apikey',
  'accesskey',
  'secretkey',
  'privatekey',
  'clientsecret',
  'otp',
  'mfa',
  'sessionid',
  'pan',
  'aadhaar',
  'accountno',
  'accountnumber',
  'bankaccount',
  'cvv',
  'masterkey',
  'blindindexkey',
];

const normalizeKey = (k: string): string => k.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface RedactOptions {
  sensitiveKeys?: readonly string[];
  placeholder?: string;
  maxDepth?: number;
}

/**
 * Return a deep copy of `value` with sensitive fields replaced by the placeholder.
 * Does not mutate the input. Non-plain objects (Date, Buffer, etc.) are passed through by
 * reference unless they are a sensitive-keyed value.
 */
export function redact<T>(value: T, options: RedactOptions = {}): T {
  const keys = (options.sensitiveKeys ?? DEFAULT_SENSITIVE_KEYS).map(normalizeKey);
  const placeholder = options.placeholder ?? REDACTED;
  const maxDepth = options.maxDepth ?? 8;
  const seen = new WeakSet<object>();

  const isSensitive = (key: string): boolean => {
    const n = normalizeKey(key);
    return keys.some((k) => n === k || n.includes(k));
  };

  const walk = (input: unknown, depth: number): unknown => {
    if (input === null || typeof input !== 'object') return input;
    if (depth >= maxDepth) return '[TRUNCATED]';
    if (seen.has(input as object)) return '[CIRCULAR]';
    seen.add(input as object);

    if (Array.isArray(input)) return input.map((item) => walk(item, depth + 1));

    // Leave non-plain objects (Date, Buffer, streams) alone.
    const proto = Object.getPrototypeOf(input);
    if (proto !== Object.prototype && proto !== null) return input;

    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      out[key] = isSensitive(key) ? placeholder : walk(val, depth + 1);
    }
    return out;
  };

  return walk(value, 0) as T;
}

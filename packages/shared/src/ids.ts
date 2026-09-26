import { ulid } from 'ulid';

/**
 * Application identifiers exposed in URLs are ULIDs (128-bit, lexicographically sortable,
 * non-guessable). This avoids sequential-id enumeration / IDOR while keeping ids sortable
 * for pagination. See ADR-0003.
 */
export type Ulid = string;

// Crockford base32 alphabet excludes I, L, O and U. A ULID is 26 such characters.
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Generate a new ULID. Pass a fixed time only in tests. */
export function newId(seedTime?: number): Ulid {
  return ulid(seedTime);
}

/** True if `value` is a syntactically valid ULID (Crockford base32, 26 chars). */
export function isId(value: unknown): value is Ulid {
  return typeof value === 'string' && ULID_RE.test(value);
}

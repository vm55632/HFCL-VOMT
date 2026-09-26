import { createHash } from 'node:crypto';

/** The genesis previous-hash for the first row in the chain. */
export const GENESIS_HASH = '0'.repeat(64);

/**
 * The canonical, hashed content of an audit row. Only these fields are covered by the hash chain;
 * `seq` and storage bookkeeping are not, so re-numbering cannot silently alter history.
 */
export interface AuditPayload {
  id: string;
  at: string; // ISO-8601 UTC
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  outcome: string;
  detail: unknown;
  correlationId: string | null;
}

/** Deterministic JSON with recursively sorted object keys, so hashing is stable. */
export function canonicalize(value: unknown): string {
  const seen = new WeakSet<object>();
  const norm = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) return '[CIRCULAR]';
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(norm);
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) out[key] = norm(obj[key]);
    return out;
  };
  return JSON.stringify(norm(value));
}

/** row_hash = SHA-256( canonical(payload) || "|" || prevHash ). */
export function computeRowHash(payload: AuditPayload, prevHash: string): string {
  return createHash('sha256')
    .update(canonicalize(payload))
    .update('|')
    .update(prevHash)
    .digest('hex');
}

export interface ChainRow extends AuditPayload {
  prevHash: string;
  rowHash: string;
}

export interface ChainVerification {
  valid: boolean;
  /** The `id` of the first row that fails verification, if any. */
  brokenAt?: string;
  reason?: string;
}

/**
 * Verify an ordered (by seq ascending) slice of the chain: each row's prevHash must equal the
 * previous row's rowHash, and each rowHash must recompute from its own payload. Detects insertion,
 * deletion, reordering and edits.
 */
export function verifyChain(
  rows: readonly ChainRow[],
  startPrev = GENESIS_HASH,
): ChainVerification {
  let prev = startPrev;
  for (const row of rows) {
    if (row.prevHash !== prev) {
      return {
        valid: false,
        brokenAt: row.id,
        reason: 'prevHash does not match preceding rowHash',
      };
    }
    const expected = computeRowHash(
      {
        id: row.id,
        at: row.at,
        actorId: row.actorId,
        actorRole: row.actorRole,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        outcome: row.outcome,
        detail: row.detail,
        correlationId: row.correlationId,
      },
      row.prevHash,
    );
    if (expected !== row.rowHash) {
      return { valid: false, brokenAt: row.id, reason: 'rowHash does not match payload' };
    }
    prev = row.rowHash;
  }
  return { valid: true };
}

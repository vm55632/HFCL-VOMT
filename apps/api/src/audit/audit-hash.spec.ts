import {
  GENESIS_HASH,
  canonicalize,
  computeRowHash,
  verifyChain,
  type AuditPayload,
  type ChainRow,
} from './audit-hash';

function payload(overrides: Partial<AuditPayload>): AuditPayload {
  return {
    id: 'id',
    at: '2026-01-01T00:00:00.000Z',
    actorId: null,
    actorRole: null,
    action: 'test.action',
    entityType: null,
    entityId: null,
    outcome: 'SUCCESS',
    detail: null,
    correlationId: null,
    ...overrides,
  };
}

function row(overrides: Partial<AuditPayload>, prev: string): ChainRow {
  const p = payload(overrides);
  return { ...p, prevHash: prev, rowHash: computeRowHash(p, prev) };
}

describe('canonicalize', () => {
  it('produces stable output regardless of key order', () => {
    expect(canonicalize({ b: 1, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":1}');
  });
});

describe('verifyChain', () => {
  it('accepts a well-formed chain', () => {
    const r1 = row({ id: 'a', action: 'login' }, GENESIS_HASH);
    const r2 = row({ id: 'b', action: 'approve' }, r1.rowHash);
    const r3 = row({ id: 'c', action: 'export' }, r2.rowHash);
    expect(verifyChain([r1, r2, r3]).valid).toBe(true);
  });

  it('detects an edited payload', () => {
    const r1 = row({ id: 'a' }, GENESIS_HASH);
    const r2 = row({ id: 'b', action: 'approve' }, r1.rowHash);
    // Someone edits the stored action but cannot recompute the whole chain.
    const tampered: ChainRow = { ...r2, action: 'reject' };
    const res = verifyChain([r1, tampered]);
    expect(res.valid).toBe(false);
    expect(res.brokenAt).toBe('b');
  });

  it('detects a deleted / reordered row via the prevHash link', () => {
    const r1 = row({ id: 'a' }, GENESIS_HASH);
    const r2 = row({ id: 'b' }, r1.rowHash);
    const r3 = row({ id: 'c' }, r2.rowHash);
    // r2 removed: r3.prevHash no longer matches the preceding row (r1).
    const res = verifyChain([r1, r3]);
    expect(res.valid).toBe(false);
    expect(res.brokenAt).toBe('c');
  });

  it('starts from the genesis hash', () => {
    const bad = row({ id: 'a' }, 'not-the-genesis-hash');
    expect(verifyChain([bad]).valid).toBe(false);
  });
});

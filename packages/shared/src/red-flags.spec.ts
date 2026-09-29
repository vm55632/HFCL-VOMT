import { crossChecks, evaluateRedFlags } from './red-flags';

describe('crossChecks', () => {
  it('confirms the PAN embedded in the GSTIN', () => {
    const c = crossChecks({ vendorPan: 'AAACA1234A', gstin: '27AAACA1234A1Z5' });
    expect(c.find((x) => x.key === 'pan_in_gstin')?.ok).toBe(true);
  });
  it('flags a GSTIN embedding a different PAN', () => {
    const c = crossChecks({ vendorPan: 'ZZZZZ9999Z', gstin: '27AAACA1234A1Z5' });
    expect(c.find((x) => x.key === 'pan_in_gstin')?.ok).toBe(false);
  });
  it('passes matching PAN and GST names, fails clearly different ones', () => {
    expect(
      crossChecks({
        panName: 'Acme Cloud Pvt Ltd',
        gstLegalName: 'ACME CLOUD PRIVATE LIMITED',
      }).find((x) => x.key === 'pan_gst_name')?.ok,
    ).toBe(true);
    expect(
      crossChecks({ panName: 'Acme Cloud', gstLegalName: 'Globex Systems' }).find(
        (x) => x.key === 'pan_gst_name',
      )?.ok,
    ).toBe(false);
  });
});

describe('evaluateRedFlags', () => {
  it('raises high-severity flags for employee bank match and shared bank', () => {
    const flags = evaluateRedFlags({ bankMatchesEmployee: true, otherActiveCasesSharingBank: 2 });
    const keys = flags.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(['bank_matches_employee', 'shared_bank_account']));
    expect(flags.every((f) => f.severity === 'high')).toBe(true);
  });

  it('flags a cancelled GST registration', () => {
    expect(evaluateRedFlags({ gstStatus: 'Cancelled' }).map((f) => f.key)).toContain(
      'gst_not_active',
    );
  });

  it('flags a recently incorporated company with high spend', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const flags = evaluateRedFlags({ incorporationDate: '2026-01-01', spend: 1_000_000, now });
    expect(flags.map((f) => f.key)).toContain('recent_incorporation_high_spend');
  });

  it('does not flag an old company even at high spend', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const flags = evaluateRedFlags({ incorporationDate: '2010-01-01', spend: 1_000_000, now });
    expect(flags.map((f) => f.key)).not.toContain('recent_incorporation_high_spend');
  });

  it('is empty for a clean vendor', () => {
    expect(evaluateRedFlags({ gstStatus: 'Active', spend: 10_000 })).toEqual([]);
  });
});

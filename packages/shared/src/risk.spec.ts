import { assessRisk, dueDiligencePack } from './risk';

describe('assessRisk', () => {
  it('rates a benign low-spend vendor as low', () => {
    const r = assessRisk({
      spend: 50_000,
      dataAccess: 'No firm or client data',
      systemAccess: 'None',
    });
    expect(r.tier).toBe('low');
    expect(r.score).toBe(0);
  });

  it('escalates with spend, data and system access', () => {
    const r = assessRisk({
      spend: 2_000_000, // +3
      dataAccess: 'Regulated / special-category data', // +5
      systemAccess: 'Privileged', // +3
    });
    expect(r.score).toBe(11);
    expect(r.tier).toBe('critical');
  });

  it('applies certification relief but never below zero', () => {
    const base = assessRisk({ spend: 500_000 }); // +2
    expect(base.score).toBe(2);
    const relieved = assessRisk({ spend: 500_000, certifications: 'ISO 27001 + SOC 2 Type II' }); // -2
    expect(relieved.score).toBe(0);
  });

  it('counts registry signals and enhanced-DD flag', () => {
    const r = assessRisk({
      gstStatus: 'Cancelled',
      panStatus: 'Inactive',
      nameMatch: 'No',
      enhancedDueDiligence: true,
    });
    expect(r.score).toBe(3 + 2 + 2 + 2);
    expect(r.tier).toBe('high');
  });

  it('maps score bands to tiers', () => {
    expect(assessRisk({ spend: 100_000 }).tier).toBe('low'); // 1
    expect(assessRisk({ spend: 100_000, subcontract: 'Yes', conflict: 'Yes' }).tier).toBe('medium'); // 4
  });
});

describe('dueDiligencePack', () => {
  it('adds tier-driven and answer-driven items', () => {
    const input = {
      spend: 2_000_000,
      dataAccess: 'Client confidential data',
      systemAccess: 'Privileged',
    };
    const r = assessRisk(input);
    const ids = dueDiligencePack(r, input).map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'incorporation',
        'financials',
        'dpa',
        'sig-lite',
        'access-request',
        'edd',
      ]),
    );
  });

  it('keeps the pack minimal for a low-tier vendor', () => {
    const input = { spend: 10_000, dataAccess: 'No firm or client data' };
    const ids = dueDiligencePack(assessRisk(input), input).map((i) => i.id);
    expect(ids).toEqual(['incorporation', 'bank-letter', 'tax-cert']);
  });
});

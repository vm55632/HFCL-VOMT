import { applicablePath } from '@vop/shared';
import { buildDefinition } from './workflows.service';

const rows = {
  key: 'std',
  name: 'Std',
  version: 2,
  status: 'PUBLISHED',
  rejectStageKey: 'rejected',
  stages: [
    {
      key: 'finance',
      name: 'Finance',
      shortName: 'Fin',
      order: 30,
      ownerRole: 'finance',
      slaBusinessDays: 2,
      terminal: false,
      applicableTiers: [],
      evidenceGate: false,
    },
    {
      key: 'draft',
      name: 'Draft',
      shortName: 'Draft',
      order: 0,
      ownerRole: 'proposer',
      slaBusinessDays: 0,
      terminal: false,
      applicableTiers: [],
      evidenceGate: false,
    },
    {
      key: 'risk',
      name: 'Risk',
      shortName: 'Risk',
      order: 20,
      ownerRole: 'compliance',
      slaBusinessDays: 5,
      terminal: false,
      applicableTiers: ['high'],
      evidenceGate: false,
    },
    {
      key: 'rejected',
      name: 'Rejected',
      shortName: 'Rej',
      order: 60,
      ownerRole: null,
      slaBusinessDays: 0,
      terminal: true,
      applicableTiers: [],
      evidenceGate: false,
    },
  ],
};

describe('buildDefinition', () => {
  it('sorts stages by order and preserves tier conditions', () => {
    const def = buildDefinition(rows);
    expect(def.stages.map((s) => s.key)).toEqual(['draft', 'risk', 'finance', 'rejected']);
    expect(def.version).toBe(2);
  });

  it('produces a definition the engine can route', () => {
    const def = buildDefinition(rows);
    // low tier skips the high-only risk stage
    expect(applicablePath(def, 'low').map((s) => s.key)).toEqual(['draft', 'finance']);
    expect(applicablePath(def, 'high').map((s) => s.key)).toEqual(['draft', 'risk', 'finance']);
  });
});

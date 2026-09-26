import {
  applicablePath,
  nextStage,
  stageApplies,
  addBusinessDays,
  dueDate,
  slaState,
  evaluateTransition,
  getStage,
  type TransitionContext,
} from './workflow';
import { DEFAULT_WORKFLOW } from './master-data';

const WF = DEFAULT_WORKFLOW;
const keys = (stages: { key: string }[]) => stages.map((s) => s.key);

const ctx = (over: Partial<TransitionContext> = {}): TransitionContext => ({
  tier: 'low',
  isStageOwner: true,
  isCaseOwner: false,
  onHold: false,
  checklistOutstanding: 0,
  ...over,
});

describe('routing', () => {
  it('low tier skips risk and approval', () => {
    expect(keys(applicablePath(WF, 'low'))).toEqual(['draft', 'procurement', 'finance']);
  });
  it('medium tier includes risk but not approval', () => {
    expect(keys(applicablePath(WF, 'medium'))).toEqual(['draft', 'procurement', 'risk', 'finance']);
  });
  it('high/critical include risk and approval', () => {
    expect(keys(applicablePath(WF, 'high'))).toEqual([
      'draft',
      'procurement',
      'risk',
      'finance',
      'approval',
    ]);
    expect(keys(applicablePath(WF, 'critical'))).toHaveLength(5);
  });
  it('stageApplies respects applicableTiers', () => {
    const risk = getStage(WF, 'risk')!;
    expect(stageApplies(risk, 'low')).toBe(false);
    expect(stageApplies(risk, 'high')).toBe(true);
  });
});

describe('nextStage', () => {
  it('procurement → finance for low (skips risk)', () => {
    expect(nextStage(WF, 'procurement', 'low')?.key).toBe('finance');
  });
  it('procurement → risk for medium', () => {
    expect(nextStage(WF, 'procurement', 'medium')?.key).toBe('risk');
  });
  it('finance → approved for low (terminal, not reject)', () => {
    expect(nextStage(WF, 'finance', 'low')?.key).toBe('approved');
  });
  it('finance → approval for high', () => {
    expect(nextStage(WF, 'finance', 'high')?.key).toBe('approval');
  });
});

describe('SLA', () => {
  it('adds business days skipping weekends', () => {
    const friday = new Date('2026-01-02T09:00:00Z'); // Friday
    expect(addBusinessDays(friday, 1).getUTCDate()).toBe(5); // Monday
  });
  it('no due date for a terminal stage', () => {
    expect(dueDate(getStage(WF, 'approved')!)).toBeNull();
    expect(dueDate(getStage(WF, 'procurement')!)).not.toBeNull();
  });
  it('classifies sla state', () => {
    const now = new Date('2026-01-10T00:00:00Z');
    expect(slaState(new Date('2026-01-09T00:00:00Z'), { now })).toBe('overdue');
    expect(slaState(new Date('2026-01-10T06:00:00Z'), { now })).toBe('due-soon');
    expect(slaState(new Date('2026-01-15T00:00:00Z'), { now })).toBe('on-track');
    expect(slaState(new Date('2026-01-15T00:00:00Z'), { now, onHold: true })).toBeNull();
  });
});

describe('evaluateTransition', () => {
  it('allows the case owner to submit a draft → procurement', () => {
    const r = evaluateTransition(
      WF,
      'draft',
      'submit',
      ctx({ isCaseOwner: true, isStageOwner: false }),
    );
    expect(r.allowed).toBe(true);
    expect(r.toStageKey).toBe('procurement');
  });

  it('denies submit from a non-owner', () => {
    const r = evaluateTransition(
      WF,
      'draft',
      'submit',
      ctx({ isCaseOwner: false, isStageOwner: false }),
    );
    expect(r.allowed).toBe(false);
  });

  it('advances procurement → finance (low) for the stage owner', () => {
    const r = evaluateTransition(WF, 'procurement', 'advance', ctx({ tier: 'low' }));
    expect(r.allowed).toBe(true);
    expect(r.toStageKey).toBe('finance');
  });

  it('blocks advance while the evidence gate has outstanding items', () => {
    const r = evaluateTransition(WF, 'procurement', 'advance', ctx({ checklistOutstanding: 2 }));
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/outstanding/);
  });

  it('denies advance to a non-stage-owner', () => {
    const r = evaluateTransition(WF, 'procurement', 'advance', ctx({ isStageOwner: false }));
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/owner/);
  });

  it('routes reject → rejected', () => {
    const r = evaluateTransition(WF, 'procurement', 'reject', ctx());
    expect(r.allowed).toBe(true);
    expect(r.toStageKey).toBe('rejected');
  });

  it('reopens a rejected case back to the first stage', () => {
    const r = evaluateTransition(WF, 'rejected', 'reopen', ctx());
    expect(r.allowed).toBe(true);
    expect(r.toStageKey).toBe('draft');
  });

  it('refuses actions on a closed (approved) case', () => {
    const r = evaluateTransition(WF, 'approved', 'advance', ctx());
    expect(r.allowed).toBe(false);
  });
});

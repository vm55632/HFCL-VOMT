/**
 * Data-driven workflow engine (generalised from the reference prototype). A workflow is an
 * ordered list of stages; each stage names the role that owns it, its SLA, whether it is an
 * evidence gate, and which risk tiers it applies to (conditional/optional stages). The engine is
 * pure — the API enforces it server-side and the web reads the same rules to draw buttons, so the
 * UI can never offer an action the server would refuse. Workflow definitions are versioned; an
 * in-flight case keeps executing the version it started on.
 */

export type WorkflowStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/** Risk tiers a case can carry (computed by the risk model in Phase 4). */
export const TIER_KEYS = ['low', 'medium', 'high', 'critical'] as const;
export type TierKey = (typeof TIER_KEYS)[number];

/** Actions that can be taken on a case at a stage. */
export const WORKFLOW_ACTIONS = [
  'submit',
  'advance',
  'return',
  'reject',
  'hold',
  'resume',
  'assign',
  'reopen',
] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

/** Which actions require a written reason. */
export const ACTION_NEEDS_NOTE: Record<WorkflowAction, boolean> = {
  submit: false,
  advance: false,
  return: true,
  reject: true,
  hold: true,
  resume: false,
  assign: false,
  reopen: true,
};

export interface WorkflowStageDef {
  key: string;
  name: string;
  shortName: string;
  order: number;
  /** Role that owns (signs off) the stage; null for system/terminal stages. */
  ownerRole: string | null;
  slaBusinessDays: number;
  /** Terminal stages end the workflow (approved / rejected). */
  terminal: boolean;
  /** If set, the stage applies only when the case tier is in this list (conditional stage). */
  applicableTiers?: TierKey[];
  /** Cannot be left while a due-diligence checklist item is outstanding. */
  evidenceGate?: boolean;
}

export interface WorkflowDefinition {
  key: string;
  name: string;
  version: number;
  status: WorkflowStatus;
  /** The terminal stage a rejection routes to. */
  rejectStageKey: string;
  stages: WorkflowStageDef[];
}

/** Stages in execution order. */
export function orderedStages(def: WorkflowDefinition): WorkflowStageDef[] {
  return [...def.stages].sort((a, b) => a.order - b.order);
}

export function getStage(def: WorkflowDefinition, key: string): WorkflowStageDef | undefined {
  return def.stages.find((s) => s.key === key);
}

/** Whether a stage applies to a case of the given tier (conditional/optional stages). */
export function stageApplies(stage: WorkflowStageDef, tier: TierKey): boolean {
  if (!stage.applicableTiers || stage.applicableTiers.length === 0) return true;
  return stage.applicableTiers.includes(tier);
}

/** The non-terminal stages a case of this tier will actually pass through, in order. */
export function applicablePath(def: WorkflowDefinition, tier: TierKey): WorkflowStageDef[] {
  return orderedStages(def).filter((s) => !s.terminal && stageApplies(s, tier));
}

/** The next applicable stage after `currentKey` for this tier, or the first terminal stage. */
export function nextStage(
  def: WorkflowDefinition,
  currentKey: string,
  tier: TierKey,
): WorkflowStageDef | undefined {
  const ordered = orderedStages(def);
  const at = ordered.findIndex((s) => s.key === currentKey);
  if (at === -1) return undefined;
  for (let i = at + 1; i < ordered.length; i++) {
    const s = ordered[i];
    if (s && !s.terminal && stageApplies(s, tier)) return s;
  }
  // No further review stage: fall through to the first terminal (approved) stage.
  return ordered.find((s) => s.terminal && s.key !== def.rejectStageKey);
}

/* ---------------- SLA ---------------- */

/** Add N business days (skipping Sat/Sun) to a date. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

/** The SLA due date for entering a stage, or null if the stage has no clock. */
export function dueDate(stage: WorkflowStageDef, from: Date = new Date()): Date | null {
  if (!stage.slaBusinessDays || stage.terminal) return null;
  return addBusinessDays(from, stage.slaBusinessDays);
}

export type SlaState = 'overdue' | 'due-soon' | 'on-track' | null;

/** SLA status for a case: overdue, due within 24h, on track, or no clock. */
export function slaState(
  dueAt: Date | null,
  opts: { onHold?: boolean; terminal?: boolean; now?: Date } = {},
): SlaState {
  if (!dueAt || opts.onHold || opts.terminal) return null;
  const now = opts.now ?? new Date();
  const hoursLeft = (dueAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursLeft < 0) return 'overdue';
  if (hoursLeft < 24) return 'due-soon';
  return 'on-track';
}

/* ---------------- transitions ---------------- */

export interface TransitionContext {
  tier: TierKey;
  /** Whether the actor owns the current stage (role match or admin override). */
  isStageOwner: boolean;
  /** Whether the actor is the case owner (proposer) — for submit from draft. */
  isCaseOwner: boolean;
  onHold: boolean;
  /** Number of outstanding due-diligence checklist items. */
  checklistOutstanding: number;
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
  /** The stage the case moves to, when the action is a transition. */
  toStageKey?: string;
}

/**
 * Validate an action against the definition and context, and compute the destination stage.
 * This is the single authority for every state transition (enforced server-side).
 */
export function evaluateTransition(
  def: WorkflowDefinition,
  currentKey: string,
  action: WorkflowAction,
  ctx: TransitionContext,
): TransitionResult {
  const stage = getStage(def, currentKey);
  if (!stage) return { allowed: false, reason: 'Unknown stage.' };
  if (stage.terminal && action !== 'reopen') {
    return { allowed: false, reason: 'The case is closed.' };
  }

  const first = applicablePath(def, ctx.tier)[0];
  const isDraft = first ? currentKey === first.key : false;

  switch (action) {
    case 'submit': {
      if (!isDraft) return { allowed: false, reason: 'Only a draft can be submitted.' };
      if (!ctx.isCaseOwner && !ctx.isStageOwner) {
        return { allowed: false, reason: 'Only the case owner can submit.' };
      }
      if (stage.evidenceGate && ctx.checklistOutstanding > 0) {
        return { allowed: false, reason: gateReason(ctx.checklistOutstanding) };
      }
      const to = nextStage(def, currentKey, ctx.tier);
      return { allowed: true, toStageKey: to?.key };
    }
    case 'advance': {
      if (!ctx.isStageOwner) return ownerDenied(stage);
      if (ctx.onHold) return { allowed: false, reason: 'Take the case off hold first.' };
      if (stage.evidenceGate && ctx.checklistOutstanding > 0) {
        return { allowed: false, reason: gateReason(ctx.checklistOutstanding) };
      }
      const to = nextStage(def, currentKey, ctx.tier);
      return { allowed: true, toStageKey: to?.key };
    }
    case 'return': {
      // Send the case back to the immediately previous stage (the previous actor), not forward.
      if (!ctx.isStageOwner) return ownerDenied(stage);
      const path = applicablePath(def, ctx.tier);
      const idx = path.findIndex((s) => s.key === currentKey);
      const prev = idx > 0 ? path[idx - 1] : path[0];
      return { allowed: true, toStageKey: prev?.key ?? currentKey };
    }
    case 'hold': {
      if (!ctx.isStageOwner) return ownerDenied(stage);
      return { allowed: true, toStageKey: currentKey };
    }
    case 'reject': {
      if (!ctx.isStageOwner) return ownerDenied(stage);
      return { allowed: true, toStageKey: def.rejectStageKey };
    }
    case 'resume': {
      if (!ctx.isStageOwner) return ownerDenied(stage);
      if (!ctx.onHold) return { allowed: false, reason: 'The case is not on hold.' };
      return { allowed: true, toStageKey: currentKey };
    }
    case 'assign': {
      if (!ctx.isStageOwner) return ownerDenied(stage);
      return { allowed: true, toStageKey: currentKey };
    }
    case 'reopen': {
      if (currentKey !== def.rejectStageKey) {
        return { allowed: false, reason: 'Only a rejected case can be reopened.' };
      }
      const to = applicablePath(def, ctx.tier)[0];
      return { allowed: true, toStageKey: to?.key };
    }
    default:
      return { allowed: false, reason: 'Unknown action.' };
  }
}

function ownerDenied(stage: WorkflowStageDef): TransitionResult {
  return { allowed: false, reason: `Only the ${stage.name} owner can act at this stage.` };
}
function gateReason(n: number): string {
  return `${n} due-diligence item${n > 1 ? 's are' : ' is'} still outstanding.`;
}

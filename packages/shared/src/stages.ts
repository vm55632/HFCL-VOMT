/**
 * Parallel review model (layered over the sequential workflow engine). When a proposer submits a
 * case it fans out to independent reviewers — FCU, Operation and Legal always, plus InfoSec when
 * the IT/PII questionnaire flagged it — who each act on their own per-stage record in parallel.
 * Once every active review stage is approved the case reaches the SAP confirmation gate, where the
 * SAP role sees each stage's completion and confirms the vendor into SAP/ERP (the final stage).
 */

/** The parallel review stages a case can carry (each has its own table + owning role). */
export const REVIEW_STAGES = ['infosec', 'fcu', 'operation', 'legal'] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];

/** The final confirmation stage key. */
export const SAP_STAGE = 'sap';

/** High-level case phases held on `case.stage`. */
export const CASE_PHASES = ['draft', 'review', 'sap', 'approved', 'rejected'] as const;
export type CasePhase = (typeof CASE_PHASES)[number];

/** Per-stage review record status. */
export const STAGE_STATUSES = ['pending', 'approved', 'rejected', 'sent_back'] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

/** The role that owns each review stage (role key === stage key here). */
export const STAGE_ROLE: Record<ReviewStage, string> = {
  infosec: 'infosec',
  fcu: 'fcu',
  operation: 'operation',
  legal: 'legal',
};

/** Human labels for stages/phases shown in the UI. */
export const STAGE_LABELS: Record<string, string> = {
  draft: 'Draft',
  review: 'In review',
  infosec: 'InfoSec',
  fcu: 'FCU',
  operation: 'Operation',
  legal: 'Legal',
  sap: 'SAP confirmation',
  approved: 'Approved',
  rejected: 'Rejected',
};

/** The review stages that are active for a case: FCU/Operation/Legal always, InfoSec if flagged. */
export function activeReviewStages(infosecRequired: boolean): ReviewStage[] {
  return REVIEW_STAGES.filter((s) => s !== 'infosec' || infosecRequired);
}

/**
 * Segregation-of-Duties rules for access approvals (pure functions, unit-tested). A user cannot
 * approve their own access request, cannot approve a request from someone in their own reporting
 * chain (a conflict of interest), and must have the authority to approve (the requester's direct
 * manager, or a platform admin acting as escalation).
 */

export interface ApprovalContext {
  approverId: string;
  requesterId: string;
  /** The requester's direct manager id, if known. */
  requesterManagerId: string | null;
  /** Whether the approver holds a platform-admin authority (can act as escalation). */
  approverIsPlatformAdmin: boolean;
  /** Manager ids strictly above the approver (the approver's reporting chain, upward). */
  approverReportingChainUp: readonly string[];
}

export interface SodDecision {
  allowed: boolean;
  reason?: string;
}

export function evaluateRegistrationApproval(ctx: ApprovalContext): SodDecision {
  if (ctx.approverId === ctx.requesterId) {
    return { allowed: false, reason: 'You cannot approve your own access request.' };
  }
  // Conflict: the requester is someone the approver reports to (up their chain).
  if (ctx.approverReportingChainUp.includes(ctx.requesterId)) {
    return {
      allowed: false,
      reason: 'Conflict of interest: the requester is in your reporting chain.',
    };
  }
  const isDirectManager = ctx.requesterManagerId === ctx.approverId;
  if (!isDirectManager && !ctx.approverIsPlatformAdmin) {
    return {
      allowed: false,
      reason: "Only the requester's manager or a platform admin can approve this request.",
    };
  }
  return { allowed: true };
}

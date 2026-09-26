import { evaluateRegistrationApproval, type ApprovalContext } from './sod';

const base: ApprovalContext = {
  approverId: 'mgr',
  requesterId: 'emp',
  requesterManagerId: 'mgr',
  approverIsPlatformAdmin: false,
  approverReportingChainUp: [],
};

describe('evaluateRegistrationApproval (Segregation of Duties)', () => {
  it('allows the direct manager to approve', () => {
    expect(evaluateRegistrationApproval(base).allowed).toBe(true);
  });

  it('allows a platform admin to approve as escalation', () => {
    const r = evaluateRegistrationApproval({
      ...base,
      approverId: 'admin',
      requesterManagerId: 'someone-else',
      approverIsPlatformAdmin: true,
    });
    expect(r.allowed).toBe(true);
  });

  // --- negative cases ---
  it('forbids approving your own request', () => {
    const r = evaluateRegistrationApproval({ ...base, approverId: 'emp', requesterId: 'emp' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/your own/i);
  });

  it('forbids approving a request from someone in your reporting chain', () => {
    const r = evaluateRegistrationApproval({
      ...base,
      requesterId: 'boss',
      approverReportingChainUp: ['boss', 'ceo'],
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/conflict/i);
  });

  it('forbids approval by someone who is neither the manager nor a platform admin', () => {
    const r = evaluateRegistrationApproval({
      ...base,
      approverId: 'stranger',
      requesterManagerId: 'mgr',
      approverIsPlatformAdmin: false,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/manager or a platform admin/i);
  });
});

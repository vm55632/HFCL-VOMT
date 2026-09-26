import type { TierKey } from './workflow';

/**
 * Risk model — computes the tier that drives workflow routing and the due-diligence pack a case
 * must collect. Ported from the reference prototype. The tier is ALWAYS computed server-side on
 * submit/amend (a client can never set its own rating); the web shows the same result as a live rail.
 */

export interface RiskInput {
  /** Expected annual spend (USD). */
  spend?: number;
  dataAccess?: string;
  systemAccess?: string;
  subcontract?: string;
  delivery?: string;
  screening?: string;
  conflict?: string;
  litigation?: string;
  insurance?: string;
  certifications?: string;
  // Registry signals (from PAN/GST lookups, not the vendor).
  gstStatus?: string;
  panStatus?: string;
  nameMatch?: string;
  taxpayerType?: string;
  /** Category flag (e.g. related party / foreign) — enhanced due diligence. */
  enhancedDueDiligence?: boolean;
}

export interface RiskDriver {
  points: number;
  reason: string;
}
export interface RiskResult {
  score: number;
  tier: TierKey;
  drivers: RiskDriver[];
}

const TIER_THRESHOLDS: { max: number; key: TierKey }[] = [
  { max: 3, key: 'low' },
  { max: 6, key: 'medium' },
  { max: 9, key: 'high' },
  { max: Number.POSITIVE_INFINITY, key: 'critical' },
];

const DATA_POINTS: Record<string, number> = {
  'No firm or client data': 0,
  'Firm internal data only': 1,
  'Personal data (employee or candidate)': 3,
  'Client confidential data': 4,
  'Regulated / special-category data': 5,
};
const SYSTEM_POINTS: Record<string, number> = { None: 0, 'Read-only': 1, Privileged: 3 };
const CERTIFIED = ['ISO 27001', 'SOC 2 Type II', 'ISO 27001 + SOC 2 Type II', 'PCI DSS'];

export function assessRisk(input: RiskInput): RiskResult {
  const drivers: RiskDriver[] = [];
  let score = 0;
  const add = (n: number, reason: string): void => {
    if (n) {
      score += n;
      drivers.push({ points: n, reason });
    }
  };

  const spend = Number(input.spend) || 0;
  add(
    spend >= 2_000_000 ? 3 : spend >= 500_000 ? 2 : spend >= 100_000 ? 1 : 0,
    'Annual spend band',
  );
  add(DATA_POINTS[input.dataAccess ?? ''] ?? 0, `Data access: ${input.dataAccess ?? 'n/a'}`);
  add(
    SYSTEM_POINTS[input.systemAccess ?? ''] ?? 0,
    `System access: ${input.systemAccess ?? 'n/a'}`,
  );
  add(input.subcontract === 'Yes' ? 1 : 0, 'Work is subcontracted');
  add(input.delivery === 'Offshore' ? 1 : 0, 'Offshore delivery model');
  add(
    input.screening === 'Confirmed' ? 5 : input.screening === 'Potential match' ? 3 : 0,
    'Screening hit',
  );
  add(input.conflict === 'Yes' ? 2 : 0, 'Declared relationship with personnel');
  add(
    input.litigation === 'Yes — ongoing' ? 2 : input.litigation === 'Yes — concluded' ? 1 : 0,
    'Litigation disclosed',
  );
  add(input.insurance === 'None' ? 1 : 0, 'No professional indemnity cover');
  add(input.enhancedDueDiligence ? 2 : 0, 'Category requires enhanced due diligence');

  // Registry signals.
  add(input.gstStatus && input.gstStatus !== 'Active' ? 3 : 0, 'GST registration not Active');
  add(input.panStatus && input.panStatus !== 'Active' ? 2 : 0, 'PAN not Active');
  add(input.nameMatch === 'No' ? 2 : 0, 'PAN and GST names do not match');
  add(input.taxpayerType === 'Composition' ? 1 : 0, 'Composition taxpayer');

  // Relief for held certifications (never below zero).
  if (input.certifications && CERTIFIED.includes(input.certifications) && score > 0) {
    const relief = input.certifications.includes('+') ? 2 : 1;
    score = Math.max(0, score - relief);
    drivers.push({ points: -relief, reason: `${input.certifications} held` });
  }

  const tier = TIER_THRESHOLDS.find((t) => score <= t.max)!.key;
  return { score, tier, drivers };
}

export interface ChecklistItem {
  id: string;
  label: string;
  role: string;
}

/** The due-diligence checklist a case must collect, given its tier and answers. */
export function dueDiligencePack(result: RiskResult, input: RiskInput): ChecklistItem[] {
  const out: ChecklistItem[] = [
    { id: 'incorporation', label: 'Certificate of incorporation', role: 'procurement' },
    { id: 'bank-letter', label: 'Bank letter on company letterhead', role: 'finance' },
    { id: 'tax-cert', label: 'Tax registration certificate', role: 'procurement' },
  ];
  const t = result.tier;
  if (t !== 'low')
    out.push({ id: 'financials', label: 'Audited financials — last 2 years', role: 'procurement' });
  if (input.dataAccess && input.dataAccess !== 'No firm or client data')
    out.push({ id: 'dpa', label: 'Data processing agreement', role: 'compliance' });
  if (
    input.dataAccess === 'Client confidential data' ||
    input.dataAccess === 'Regulated / special-category data'
  )
    out.push({ id: 'sig-lite', label: 'Security questionnaire (SIG Lite)', role: 'compliance' });
  if (input.systemAccess === 'Privileged')
    out.push({
      id: 'access-request',
      label: 'Named-user access request + background checks',
      role: 'compliance',
    });
  if (input.subcontract === 'Yes')
    out.push({
      id: 'subcontractors',
      label: 'Subcontractor list with flow-down',
      role: 'procurement',
    });
  if (input.insurance === 'None')
    out.push({
      id: 'insurance-waiver',
      label: 'Insurance waiver approved by Legal',
      role: 'compliance',
    });
  if (t === 'high' || t === 'critical')
    out.push({ id: 'edd', label: 'Enhanced due diligence report', role: 'compliance' });
  if (t === 'critical')
    out.push({
      id: 'partner-signoff',
      label: 'Risk & Compliance partner sign-off',
      role: 'approver',
    });
  return out;
}

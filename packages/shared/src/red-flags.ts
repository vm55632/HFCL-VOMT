import { nameMatchScore, nameMatchVerdict } from './name-match';

/* ---------------- statutory cross-checks ---------------- */

export interface CrossCheckInput {
  vendorPan?: string;
  gstin?: string;
  panName?: string;
  gstLegalName?: string;
  bankHolderName?: string;
}
export interface CrossCheck {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
}

/** Offline consistency checks between PAN, GSTIN and bank identities (prompt §5 cross-checks). */
export function crossChecks(input: CrossCheckInput): CrossCheck[] {
  const out: CrossCheck[] = [];

  if (input.vendorPan && input.gstin && input.gstin.length >= 12) {
    const embedded = input.gstin.slice(2, 12).toUpperCase();
    const ok = embedded === input.vendorPan.toUpperCase();
    out.push({
      key: 'pan_in_gstin',
      label: 'PAN embedded in GSTIN matches vendor PAN',
      ok,
      detail: ok ? undefined : `GSTIN embeds ${embedded}`,
    });
  }
  if (input.panName && input.gstLegalName) {
    const score = nameMatchScore(input.panName, input.gstLegalName);
    out.push({
      key: 'pan_gst_name',
      label: 'PAN name matches GST legal name',
      ok: nameMatchVerdict(score) !== 'mismatch',
      detail: `score ${score.toFixed(2)}`,
    });
  }
  if (input.bankHolderName && (input.panName || input.gstLegalName)) {
    const ref = input.panName ?? input.gstLegalName!;
    const score = nameMatchScore(input.bankHolderName, ref);
    out.push({
      key: 'bank_name',
      label: 'Bank account holder matches vendor name',
      ok: nameMatchVerdict(score) !== 'mismatch',
      detail: `score ${score.toFixed(2)}`,
    });
  }
  return out;
}

/* ---------------- red-flag rules engine ---------------- */

export type RedFlagSeverity = 'high' | 'medium' | 'low';
export interface RedFlag {
  key: string;
  severity: RedFlagSeverity;
  message: string;
}

/**
 * Context assembled by the server (DB lookups for employee/shared-bank matches, registry status)
 * and passed to the pure rules engine. Extend the rules here; they are intentionally data-driven
 * on the context so the evaluation stays testable.
 */
export interface RedFlagContext {
  bankMatchesEmployee?: boolean;
  emailMatchesEmployee?: boolean;
  phoneMatchesEmployee?: boolean;
  otherActiveCasesSharingBank?: number;
  gstStatus?: string | null;
  spend?: number;
  incorporationDate?: string | null;
  panGstNameMismatch?: boolean;
  now?: Date;
}

const HIGH_SPEND = 500_000;
const RECENT_MONTHS = 12;

export function evaluateRedFlags(ctx: RedFlagContext): RedFlag[] {
  const flags: RedFlag[] = [];
  const add = (key: string, severity: RedFlagSeverity, message: string) =>
    flags.push({ key, severity, message });

  if (ctx.bankMatchesEmployee) {
    add('bank_matches_employee', 'high', "Vendor bank account matches an employee's bank account.");
  }
  if (ctx.emailMatchesEmployee) {
    add('email_matches_employee', 'high', 'Vendor contact email matches an employee.');
  }
  if (ctx.phoneMatchesEmployee) {
    add('phone_matches_employee', 'medium', 'Vendor contact phone matches an employee.');
  }
  if ((ctx.otherActiveCasesSharingBank ?? 0) > 0) {
    add(
      'shared_bank_account',
      'high',
      `Bank account is shared with ${ctx.otherActiveCasesSharingBank} other vendor case(s).`,
    );
  }
  if (ctx.gstStatus && ctx.gstStatus !== 'Active') {
    add('gst_not_active', 'high', `GST registration is ${ctx.gstStatus}.`);
  }
  if (ctx.incorporationDate && (ctx.spend ?? 0) >= HIGH_SPEND) {
    const now = ctx.now ?? new Date();
    const inc = new Date(ctx.incorporationDate);
    const months = (now.getTime() - inc.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (months >= 0 && months < RECENT_MONTHS) {
      add(
        'recent_incorporation_high_spend',
        'medium',
        'Recently incorporated company with high spend.',
      );
    }
  }
  if (ctx.panGstNameMismatch) {
    add('pan_gst_name_mismatch', 'medium', 'PAN and GST legal names do not match.');
  }
  return flags;
}

'use client';
import Link from 'next/link';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '../../../lib/api';
import { validatePan, validateGstin, validateIfsc } from '@vop/shared';
import { lookupIfsc } from '../../../lib/ifsc';

interface SubCategory {
  key: string;
  name: string;
}
interface Category {
  key: string;
  name: string;
  enhancedDueDiligence: boolean;
  subCategories: SubCategory[];
}
interface Duplicate {
  field: string;
  ref: string;
  legalName: string;
}
interface CreateResult {
  id: string;
  ref: string;
  tier: string;
  riskScore?: number;
  duplicates: Duplicate[];
}
interface PanFields {
  name?: string;
  fatherName?: string;
  category?: string;
  panStatus?: string;
  aadhaarLinked?: boolean;
  aadhaarStatus?: string;
  maskedAadhaar?: string;
  dob?: string;
  gender?: string;
}
interface GstinEntry {
  gstin: string;
  authStatus?: string;
}
interface PanResult {
  verified: boolean;
  name?: string;
  status?: string;
  message?: string;
  fields?: PanFields;
  gstins?: GstinEntry[];
}
interface GstFiling {
  filingYear?: string;
  monthOfFiling?: string;
  methodOfFilling?: string;
  dateOfFiling?: string;
  gstType?: string;
  gstStatus?: string;
}
interface GstDetails {
  gstin: string;
  legalName?: string;
  tradeName?: string;
  constitutionOfBusiness?: string;
  taxPayerType?: string;
  gstStatus?: string;
  registrationDate?: string;
  principalAddress?: string;
  state?: string;
  city?: string;
  pincode?: string;
  latestFiling?: GstFiling;
  filings?: GstFiling[];
}
interface GstResult {
  verified: boolean;
  gstin: string;
  message?: string;
  details?: GstDetails;
}
interface BankNameMatch {
  score: number;
  matched: boolean;
  matchedAgainst?: string;
  bestName?: string;
}
interface BankDetails {
  accountNumber?: string;
  ifsc?: string;
  active?: boolean;
  activeStatus?: string;
  holderName?: string;
  bankRRN?: string;
  reason?: string;
  message?: string;
}
interface BankResult {
  verified: boolean;
  active?: boolean;
  details?: BankDetails;
  nameMatch?: BankNameMatch;
  message?: string;
}
interface MsmeDetails {
  udyamNumber?: string;
  registrationDate?: string;
  organizationType?: string;
  enterpriseType?: string;
  officialName?: string;
  majorActivity?: string;
}
interface MsmeResult {
  verified: boolean;
  pan: string;
  message?: string;
  details?: MsmeDetails;
}

const initial = {
  categoryKey: '',
  subCategoryKey: '',
  legalName: '',
  tradeName: '',
  businessAddress: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  signatoryName: '',
  signatoryEmail: '',
  signatoryMobile: '',
  signatoryPan: '',
  pan: '',
  gstin: '',
  ifsc: '',
  bankAccount: '',
  bankName: '',
  branch: '',
  businessUnit: '',
  costCentre: '',
  spend: '',
  contractMonths: '',
  natureOfService: '',
  justification: '',
  coiDeclared: false,
  coiDetails: '',
  dataAccess: 'No firm or client data',
  systemAccess: 'None',
  subcontract: 'No',
  delivery: 'Onshore',
  screening: 'Clear',
  conflict: 'No',
  litigation: 'None',
  insurance: 'Adequate',
  certifications: 'None',
  // information security questionnaire ('' = unanswered, 'yes' | 'no')
  isecItHardware: '',
  isecItSoftware: '',
  isecAccessSystem: '',
  isecAccessNetwork: '',
  isecAccessApps: '',
  isecAccessPii: '',
};

// InfoSec questionnaire — any "yes" routes the case to InfoSec review.
const INFOSEC_QUESTIONS: { key: string; label: string }[] = [
  { key: 'isecItHardware', label: 'Information Technology — Hardware' },
  { key: 'isecItSoftware', label: 'Information Technology — Software' },
  { key: 'isecAccessSystem', label: "Does the entity require access to HFCL's systems?" },
  { key: 'isecAccessNetwork', label: "Does the vendor require access to HFCL's IT network?" },
  { key: 'isecAccessApps', label: "Does the vendor require access to any of HFCL's applications?" },
  {
    key: 'isecAccessPii',
    label:
      "Does the entity require access to HFCL's customer, employee (on/off roll), partner, etc. Personally Identifiable Information (PII)?",
  },
];

export default function NewCase() {
  return (
    <Suspense fallback={<main className="wrap" />}>
      <NewCaseInner />
    </Suspense>
  );
}

function NewCaseInner() {
  const editId = useSearchParams()?.get('id') ?? '';
  const [cats, setCats] = useState<Category[]>([]);
  const [f, setF] = useState({ ...initial });
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // When on, the SPOC details mirror the authorised signatory.
  const [spocSame, setSpocSame] = useState(false);
  // Edit mode (proposer amending a sent-back draft): the PAN was verified earlier, so the form is
  // unlocked without re-verifying, and masked identifiers are left untouched unless re-entered.
  const [panLocked, setPanLocked] = useState(false);
  const [remark, setRemark] = useState<string | null>(null);
  const editLoaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const c = await apiFetch<Category[]>('/categories');
      setCats(c);
      setF((prev) => ({ ...prev, categoryKey: prev.categoryKey || (c[0]?.key ?? '') }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load categories.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // Edit mode: pre-fill the form from an existing (sent-back) draft and show the reviewer's remark.
  useEffect(() => {
    if (!editId || editLoaded.current) return;
    editLoaded.current = true;
    const bs = (b: boolean) => (b ? 'yes' : 'no');
    void apiFetch<Record<string, unknown>>(`/cases/${editId}`)
      .then((c) => {
        const str = (v: unknown) => (v == null ? '' : String(v));
        setF((prev) => ({
          ...prev,
          categoryKey: str(c.categoryKey),
          subCategoryKey: str(c.subCategoryKey),
          legalName: str(c.legalName),
          tradeName: str(c.tradeName),
          businessAddress: str(c.businessAddress),
          contactName: str(c.contactName),
          contactEmail: str(c.contactEmail),
          contactPhone: str(c.contactPhone),
          signatoryName: str(c.signatoryName),
          signatoryEmail: str(c.signatoryEmail),
          signatoryMobile: str(c.signatoryMobile),
          signatoryPan: str(c.signatoryPan),
          pan: str(c.pan),
          gstin: str(c.gstin),
          ifsc: str(c.ifsc),
          bankAccount: str(c.bankAccount),
          bankName: str(c.bankName),
          branch: str(c.branch),
          businessUnit: str(c.businessUnit),
          costCentre: str(c.costCentre),
          spend: c.spend ? String(c.spend) : '',
          contractMonths: c.contractMonths ? String(c.contractMonths) : '',
          natureOfService: str(c.natureOfService),
          justification: str(c.justification),
          coiDeclared: Boolean(c.coiDeclared),
          coiDetails: str(c.coiDetails),
          isecItHardware: bs(Boolean(c.isecItHardware)),
          isecItSoftware: bs(Boolean(c.isecItSoftware)),
          isecAccessSystem: bs(Boolean(c.isecAccessSystem)),
          isecAccessNetwork: bs(Boolean(c.isecAccessNetwork)),
          isecAccessApps: bs(Boolean(c.isecAccessApps)),
          isecAccessPii: bs(Boolean(c.isecAccessPii)),
        }));
        setPanLocked(true);
        const activity = (c.activity as { action: string; note: string | null }[]) ?? [];
        const ret = [...activity]
          .reverse()
          .find((a) => a.action === 'return' || a.action === 'infosec_returned');
        if (ret?.note) setRemark(ret.note);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the case.'));
  }, [editId]);

  const set = (k: keyof typeof initial, v: string | boolean) =>
    setF((prev) => ({ ...prev, [k]: v }));

  // Changing the category resets the dependent sub-category.
  const setCategory = (key: string) =>
    setF((prev) => ({ ...prev, categoryKey: key, subCategoryKey: '' }));

  const selectedCat = cats.find((c) => c.key === f.categoryKey);
  const subs = selectedCat?.subCategories ?? [];

  // Masked values echoed back from the server in edit mode (contain bullets) are left as-is and
  // must not be treated as invalid input.
  const masked = (v: string) => v.includes('•');
  // --- statutory validation (shared validators; same rules run again server-side) ---
  const panErr =
    f.pan && !masked(f.pan) && !validatePan(f.pan).valid ? validatePan(f.pan).errors[0] : null;
  const gstRes = f.gstin && !masked(f.gstin) ? validateGstin(f.gstin, f.pan || undefined) : null;
  const gstErr = gstRes && !gstRes.valid ? gstRes.errors[0] : null;
  const ifscErr = f.ifsc && !validateIfsc(f.ifsc).valid ? validateIfsc(f.ifsc).errors[0] : null;
  // --- authorized signatory validation ---
  const sigPanErr =
    f.signatoryPan && !masked(f.signatoryPan) && !validatePan(f.signatoryPan).valid
      ? validatePan(f.signatoryPan).errors[0]
      : null;
  const sigMobileErr =
    f.signatoryMobile && !/^[6-9]\d{9}$/.test(f.signatoryMobile.trim())
      ? 'Enter a valid 10-digit Indian mobile number.'
      : null;
  const sigEmailErr =
    f.signatoryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.signatoryEmail.trim())
      ? 'Enter a valid email address.'
      : null;
  // Keep SPOC in sync with the authorised signatory while "same as" is ticked.
  useEffect(() => {
    if (!spocSame) return;
    setF((prev) => ({
      ...prev,
      contactName: prev.signatoryName,
      contactEmail: prev.signatoryEmail,
      contactPhone: prev.signatoryMobile,
    }));
  }, [spocSame, f.signatoryName, f.signatoryEmail, f.signatoryMobile]);

  // --- InfoSec questionnaire ---
  const isecAnswered = INFOSEC_QUESTIONS.every(
    (q) => (f as unknown as Record<string, string>)[q.key] !== '',
  );
  const infosecWillRoute = INFOSEC_QUESTIONS.some(
    (q) => (f as unknown as Record<string, string>)[q.key] === 'yes',
  );

  // --- IFSC -> bank/branch via Razorpay, when the IFSC is well-formed ---
  const [ifscBusy, setIfscBusy] = useState(false);
  const [ifscNote, setIfscNote] = useState<string | null>(null);
  useEffect(() => {
    const code = f.ifsc.trim().toUpperCase();
    if (!validateIfsc(code).valid) {
      setIfscNote(null);
      return;
    }
    let cancelled = false;
    setIfscBusy(true);
    setIfscNote(null);
    void lookupIfsc(code).then((d) => {
      if (cancelled) return;
      setIfscBusy(false);
      if (d) {
        setF((prev) => ({ ...prev, bankName: d.bank, branch: d.branch }));
        setIfscNote(`Bank details fetched from Razorpay for ${code}.`);
      } else {
        setIfscNote('No bank found for this IFSC. Enter the bank and branch manually.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [f.ifsc]);

  // --- PAN -> registry verification (EY Nexus), auto when the PAN format is correct ---
  const [panChk, setPanChk] = useState<{ loading: boolean; result: PanResult | null }>({
    loading: false,
    result: null,
  });
  const [gstOther, setGstOther] = useState(false); // "Other" chosen -> manual GST entry
  const gstList = panChk.result?.gstins ?? [];
  // The PAN gates the rest of the form: nothing below it shows until the PAN is verified. In edit
  // mode the PAN was already verified when the case was raised, so the form is unlocked.
  const panVerified = panChk.result?.verified === true || panLocked;
  // --- GST -> full registry profile (EY serviceTypeId 30), on an explicit "Verify" click ---
  const [gstChk, setGstChk] = useState<{ loading: boolean; result: GstResult | null }>({
    loading: false,
    result: null,
  });
  // Drop any fetched profile when the selected GSTIN changes.
  useEffect(() => {
    setGstChk({ loading: false, result: null });
  }, [f.gstin]);

  const verifyGst = useCallback(() => {
    const g = f.gstin.trim().toUpperCase();
    if (!/^[0-9A-Z]{15}$/.test(g)) {
      setGstChk({
        loading: false,
        result: {
          verified: false,
          gstin: g,
          message: 'Select or enter a valid 15-character GSTIN.',
        },
      });
      return;
    }
    setGstChk({ loading: true, result: null });
    void apiFetch<GstResult>('/verification/gst', {
      method: 'POST',
      body: JSON.stringify({ gstin: g }),
    })
      .then((r) => {
        setGstChk({ loading: false, result: r });
        // The legal/trade name fields are not shown; take the authoritative names from the GST
        // registry so the case carries the correct vendor identity.
        if (r.verified && r.details) {
          const addr = [
            r.details.principalAddress,
            [r.details.city, r.details.state, r.details.pincode].filter(Boolean).join(', '),
          ]
            .filter(Boolean)
            .join(' — ');
          setF((prev) => ({
            ...prev,
            legalName: r.details?.legalName || prev.legalName,
            tradeName: r.details?.tradeName || prev.tradeName,
            businessAddress: addr || prev.businessAddress,
          }));
        }
      })
      .catch((e) =>
        setGstChk({
          loading: false,
          result: {
            verified: false,
            gstin: g,
            message: e instanceof Error ? e.message : 'Failed.',
          },
        }),
      );
  }, [f.gstin]);

  // --- MSME / Udyam lookup against the PAN (EY serviceTypeId 92), on an explicit "Verify" click ---
  const [msmeChk, setMsmeChk] = useState<{ loading: boolean; result: MsmeResult | null }>({
    loading: false,
    result: null,
  });
  // Tracks the PAN we've already auto-fetched MSME for, so a re-render never re-fetches (which
  // would briefly clear the panel) or clobbers a good result if a retry fails.
  const msmeFetchedFor = useRef<string | null>(null);
  // Drop any fetched MSME profile when the PAN changes.
  useEffect(() => {
    setMsmeChk({ loading: false, result: null });
    msmeFetchedFor.current = null;
  }, [f.pan]);

  const verifyMsme = useCallback(() => {
    const p = f.pan.trim().toUpperCase();
    if (!validatePan(p).valid) {
      setMsmeChk({
        loading: false,
        result: { verified: false, pan: p, message: 'Enter a valid PAN first.' },
      });
      return;
    }
    setMsmeChk({ loading: true, result: null });
    void apiFetch<MsmeResult>('/verification/msme', {
      method: 'POST',
      body: JSON.stringify({ pan: p }),
    })
      .then((r) => setMsmeChk({ loading: false, result: r }))
      .catch((e) =>
        setMsmeChk({
          loading: false,
          result: { verified: false, pan: p, message: e instanceof Error ? e.message : 'Failed.' },
        }),
      );
  }, [f.pan]);

  // Fetch MSME automatically ONLY after the PAN is successfully verified — one less button for the
  // user to find. If the PAN lookup is still running, errored, or returned no record, the MSME API
  // (and the PAN→GST list, which the server gates the same way) is never called. The ref guard
  // ensures exactly one fetch per verified PAN, so later re-renders never clear or re-request it.
  useEffect(() => {
    const p = f.pan.trim().toUpperCase();
    if (!panVerified || panChk.loading || panErr) return;
    // In edit mode the PAN comes back masked — don't auto-fetch MSME against a masked value.
    if (!validatePan(p).valid) return;
    if (msmeFetchedFor.current === p) return;
    msmeFetchedFor.current = p;
    verifyMsme();
  }, [panVerified, panChk.loading, panErr, f.pan, verifyMsme]);

  // --- Bank account -> penny-less verification (EY serviceTypeId 27) + holder-name match ---
  const [bankChk, setBankChk] = useState<{ loading: boolean; result: BankResult | null }>({
    loading: false,
    result: null,
  });
  // Drop any fetched profile when the account or IFSC changes.
  useEffect(() => {
    setBankChk({ loading: false, result: null });
  }, [f.bankAccount, f.ifsc]);

  const verifyBank = useCallback(() => {
    const acct = f.bankAccount.replace(/\s+/g, '');
    const ifsc = f.ifsc.trim().toUpperCase();
    if (!/^\d{5,20}$/.test(acct) || !validateIfsc(ifsc).valid) {
      setBankChk({
        loading: false,
        result: { verified: false, message: 'Enter a valid account number and IFSC first.' },
      });
      return;
    }
    setBankChk({ loading: true, result: null });
    void apiFetch<BankResult>('/verification/bank', {
      method: 'POST',
      body: JSON.stringify({
        accountNumber: acct,
        ifsc,
        // Names the holder is matched against (≥80% required).
        panName: panChk.result?.fields?.name,
        legalName: gstChk.result?.details?.legalName ?? f.legalName,
        tradeName: gstChk.result?.details?.tradeName ?? f.tradeName,
      }),
    })
      .then((r) => setBankChk({ loading: false, result: r }))
      .catch((e) =>
        setBankChk({
          loading: false,
          result: { verified: false, message: e instanceof Error ? e.message : 'Failed.' },
        }),
      );
  }, [
    f.bankAccount,
    f.ifsc,
    f.legalName,
    f.tradeName,
    panChk.result?.fields?.name,
    gstChk.result?.details?.legalName,
    gstChk.result?.details?.tradeName,
  ]);
  useEffect(() => {
    const p = f.pan.trim().toUpperCase();
    if (!validatePan(p).valid) {
      setPanChk({ loading: false, result: null });
      return;
    }
    let cancelled = false;
    setPanChk({ loading: true, result: null });
    // New PAN -> reset any previous GST selection; the list is re-fetched for this PAN.
    setGstOther(false);
    setF((prev) => ({ ...prev, gstin: '' }));
    const timer = setTimeout(() => {
      void apiFetch<PanResult>('/verification/pan', {
        method: 'POST',
        body: JSON.stringify({ pan: p }),
      })
        .then((r) => {
          if (cancelled) return;
          setPanChk({ loading: false, result: r });
          // Pre-fill legal name from the registry when the proposer hasn't typed one.
          if (r.name) setF((prev) => (prev.legalName ? prev : { ...prev, legalName: r.name! }));
        })
        .catch((e) => {
          if (!cancelled)
            setPanChk({
              loading: false,
              result: { verified: false, message: e instanceof Error ? e.message : 'Failed.' },
            });
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [f.pan]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (panErr || gstErr || ifscErr || sigPanErr || sigMobileErr || sigEmailErr) {
      setError('Fix the highlighted PAN / GST / IFSC / signatory fields before submitting.');
      return;
    }
    if (!isecAnswered) {
      setError('Answer all Information security questions before submitting.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...f };
      payload.spend = f.spend ? Number(f.spend) : undefined;
      payload.contractMonths = f.contractMonths ? Number(f.contractMonths) : undefined;
      for (const k of [
        'tradeName',
        'businessAddress',
        'contactName',
        'contactEmail',
        'contactPhone',
        'signatoryName',
        'signatoryEmail',
        'signatoryMobile',
        'signatoryPan',
        'pan',
        'gstin',
        'ifsc',
        'bankAccount',
        'bankName',
        'branch',
        'businessUnit',
        'costCentre',
        'natureOfService',
        'coiDetails',
        'subCategoryKey',
      ])
        if (!payload[k]) delete payload[k];
      // Convert the InfoSec questionnaire answers to booleans the API expects.
      for (const q of INFOSEC_QUESTIONS)
        payload[q.key] = (f as unknown as Record<string, string>)[q.key] === 'yes';
      const res = editId
        ? await apiFetch<CreateResult>(`/cases/${editId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<CreateResult>('/cases', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setResult({ ...res, duplicates: res.duplicates ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <main className="wrap narrow">
        <h1>{editId ? 'Case updated & resubmitted' : 'Case raised'}</h1>
        <p className="lead">
          <strong>{result.ref}</strong> · risk tier <span className="pill">{result.tier}</span>
          {result.riskScore != null && <> (score {result.riskScore})</>}
        </p>
        {result.duplicates.length > 0 && (
          <div className="card">
            <strong>Possible duplicates ({result.duplicates.length})</strong>
            <ul>
              {result.duplicates.map((d, i) => (
                <li key={i}>
                  {d.field} matches <code>{d.ref}</code> · {d.legalName}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="req__actions">
          <Link className="btn" href={`/cases/${result.id}`}>
            Open case
          </Link>
          <Link className="btn btn--ghost" href="/cases">
            All cases
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <p className="crumbs">
        <Link href="/cases">Cases</Link>
      </p>
      <h1>{editId ? 'Edit & resubmit case' : 'Raise a vendor onboarding case'}</h1>
      <p className="lead">
        {editId
          ? 'Amend the details below and resubmit. The case is re-tiered and re-routed on submit.'
          : 'Enter the vendor details on their behalf. The risk tier is computed on submit.'}
      </p>
      {remark && (
        <div className="namematch namematch--warn" role="status">
          <strong>Reviewer&apos;s remark:</strong> {remark}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={submit}>
        <section className="card">
          <h2>Vendor</h2>
          <div className="grid2">
            <label>
              Vendor category
              <select value={f.categoryKey} onChange={(e) => setCategory(e.target.value)} required>
                {cats.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sub vendor category
              <select
                value={f.subCategoryKey}
                onChange={(e) => set('subCategoryKey', e.target.value)}
                disabled={subs.length === 0}
              >
                <option value="">
                  {subs.length === 0 ? 'None for this category' : 'Select a sub-category…'}
                </option>
                {subs.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Tax identifiers</h2>
          <p className="section-intro">
            Enter the PAN — its registry details and any MSME / Udyam registration load
            automatically. Then pick a GSTIN and fetch its details to add GST information.
          </p>
          <div className="grid2">
            <label>
              PAN No.
              <input
                value={f.pan}
                onChange={(e) => set('pan', e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                maxLength={10}
                readOnly={panLocked}
                className={panErr ? 'is-invalid' : ''}
              />
              {panLocked ? (
                <span className="field-ok">PAN verified when this case was raised.</span>
              ) : panErr ? (
                <span className="field-err">{panErr}</span>
              ) : panChk.loading ? (
                <span className="field-hint">Checking PAN with the income-tax registry…</span>
              ) : panChk.result?.verified ? (
                <span className="field-ok">
                  Verified{panChk.result.name ? `: ${panChk.result.name}` : ''}
                  {panChk.result.status ? ` (${panChk.result.status})` : ''}
                </span>
              ) : panChk.result?.message ? (
                <span className="field-hint">{panChk.result.message}</span>
              ) : (
                <span className="field-cap">
                  Checked automatically against the income-tax registry.
                </span>
              )}
              {panVerified && msmeChk.loading ? (
                <span className="field-cap">Checking MSME / Udyam registration…</span>
              ) : panVerified && msmeChk.result && !msmeChk.result.verified ? (
                <span className="field-cap">
                  {msmeChk.result.message ?? 'No MSME / Udyam registration for this PAN.'}
                </span>
              ) : null}
            </label>
            {panVerified && panLocked && (
              <label>
                GST No.
                <input
                  value={f.gstin}
                  onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                  placeholder="27ABCDE1234F1Z5"
                  maxLength={15}
                  className={gstErr ? 'is-invalid' : ''}
                />
                {gstErr ? (
                  <span className="field-err">{gstErr}</span>
                ) : (
                  <span className="field-cap">
                    Edit the GSTIN if needed, then fetch its details.
                  </span>
                )}
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={verifyGst}
                    disabled={
                      gstChk.loading || !/^[0-9A-Z]{15}$/.test(f.gstin.trim().toUpperCase())
                    }
                  >
                    {gstChk.loading ? 'Fetching GST details…' : 'Fetch GST details'}
                  </button>
                  {gstChk.result && !gstChk.result.verified && gstChk.result.message ? (
                    <span className="field-hint">{gstChk.result.message}</span>
                  ) : null}
                </div>
              </label>
            )}
            {panVerified && !panLocked && (
              <label>
                GST No.
                <select
                  value={gstOther ? '__other__' : f.gstin}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__other__') {
                      setGstOther(true);
                      set('gstin', '');
                    } else {
                      setGstOther(false);
                      set('gstin', v);
                    }
                  }}
                >
                  <option value="">
                    {panChk.loading
                      ? 'Fetching GSTINs…'
                      : gstList.length
                        ? 'Select GSTIN…'
                        : 'No GSTINs found for this PAN'}
                  </option>
                  {gstList.map((g) => (
                    <option key={g.gstin} value={g.gstin}>
                      {g.gstin}
                      {g.authStatus ? ` (${g.authStatus})` : ''}
                    </option>
                  ))}
                  <option value="__other__">Other (enter manually)</option>
                </select>
                {gstOther && (
                  <input
                    value={f.gstin}
                    onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                    placeholder="27ABCDE1234F1Z5"
                    maxLength={15}
                    className={gstErr ? 'is-invalid' : ''}
                    style={{ marginTop: 6 }}
                  />
                )}
                {gstErr ? (
                  <span className="field-err">{gstErr}</span>
                ) : gstRes?.valid && f.pan ? (
                  <span className="field-ok">GSTIN valid and matches PAN.</span>
                ) : (
                  <span className="field-cap">
                    GSTINs linked to the PAN load automatically. Pick one (or add another), then
                    fetch its registration details.
                  </span>
                )}
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={verifyGst}
                    disabled={
                      gstChk.loading || !/^[0-9A-Z]{15}$/.test(f.gstin.trim().toUpperCase())
                    }
                  >
                    {gstChk.loading ? 'Fetching GST details…' : 'Fetch GST details'}
                  </button>
                  {gstChk.result && !gstChk.result.verified && gstChk.result.message ? (
                    <span className="field-hint">{gstChk.result.message}</span>
                  ) : null}
                </div>
              </label>
            )}

            {panChk.result?.verified && panChk.result.fields && (
              <div className="span2 panbox">
                <div className="panbox__head">
                  <strong className="panbox__title">PAN details</strong>
                  <span className="pill pill--ok">Verified</span>
                  <span className="muted">income-tax registry</span>
                </div>
                <dl className="panbox__grid">
                  <Detail label="Name" value={panChk.result.fields.name} />
                  <Detail label="Father's name" value={panChk.result.fields.fatherName} />
                  <Detail label="Category" value={panChk.result.fields.category} />
                  <Detail label="PAN status" value={panChk.result.fields.panStatus} />
                  <Detail
                    label="Aadhaar link status"
                    value={
                      panChk.result.fields.aadhaarLinked === true
                        ? `Linked${panChk.result.fields.maskedAadhaar ? ` (${panChk.result.fields.maskedAadhaar})` : ''}`
                        : panChk.result.fields.aadhaarLinked === false
                          ? 'PAN not linked with Aadhaar'
                          : (panChk.result.fields.aadhaarStatus ?? 'Not available')
                    }
                  />
                </dl>
              </div>
            )}

            {gstChk.result?.verified && gstChk.result.details && (
              <div className="span2 panbox">
                <div className="panbox__head">
                  <strong className="panbox__title">GST registration</strong>
                  <span
                    className={`pill ${
                      /active/i.test(gstChk.result.details.gstStatus ?? '')
                        ? 'pill--ok'
                        : 'pill--warn'
                    }`}
                  >
                    {gstChk.result.details.gstStatus ?? 'status unknown'}
                  </span>
                  <span className="muted">{gstChk.result.details.gstin}</span>
                </div>
                <dl className="panbox__grid">
                  <Detail label="Legal name" value={gstChk.result.details.legalName} />
                  <Detail label="Trade name" value={gstChk.result.details.tradeName} />
                  <Detail
                    label="Constitution of business"
                    value={gstChk.result.details.constitutionOfBusiness}
                  />
                  <Detail label="Taxpayer type" value={gstChk.result.details.taxPayerType} />
                  <Detail label="GST status" value={gstChk.result.details.gstStatus} />
                  <Detail
                    label="Registration date"
                    value={gstChk.result.details.registrationDate}
                  />
                  <Detail
                    label="Principal place of business"
                    value={gstChk.result.details.principalAddress}
                  />
                  <Detail label="State" value={gstChk.result.details.state} />
                  <Detail label="City" value={gstChk.result.details.city} />
                  <Detail label="Pincode" value={gstChk.result.details.pincode} />
                </dl>
                {gstChk.result.details.latestFiling && (
                  <div className="panbox__sub">
                    <h3>Latest filing</h3>
                    <dl className="panbox__grid">
                      <Detail
                        label="Filing year"
                        value={gstChk.result.details.latestFiling.filingYear}
                      />
                      <Detail
                        label="Period"
                        value={gstChk.result.details.latestFiling.monthOfFiling}
                      />
                      <Detail
                        label="Return type"
                        value={gstChk.result.details.latestFiling.gstType}
                      />
                      <Detail
                        label="Mode"
                        value={gstChk.result.details.latestFiling.methodOfFilling}
                      />
                      <Detail
                        label="Filed on"
                        value={gstChk.result.details.latestFiling.dateOfFiling}
                      />
                      <Detail label="Status" value={gstChk.result.details.latestFiling.gstStatus} />
                    </dl>
                  </div>
                )}
              </div>
            )}

            {msmeChk.result?.verified && msmeChk.result.details && (
              <div className="span2 panbox">
                <div className="panbox__head">
                  <strong className="panbox__title">MSME / Udyam registration</strong>
                  <span className="pill pill--ok">
                    {msmeChk.result.details.enterpriseType ?? 'Registered'}
                  </span>
                  <span className="muted">{msmeChk.result.pan}</span>
                </div>
                <dl className="panbox__grid">
                  <Detail label="Udyam / MSME number" value={msmeChk.result.details.udyamNumber} />
                  <Detail
                    label="Registration date"
                    value={msmeChk.result.details.registrationDate}
                  />
                  <Detail
                    label="Organization type"
                    value={msmeChk.result.details.organizationType}
                  />
                  <Detail label="Enterprise type" value={msmeChk.result.details.enterpriseType} />
                  <Detail label="Enterprise name" value={msmeChk.result.details.officialName} />
                  <Detail label="Major activity" value={msmeChk.result.details.majorActivity} />
                </dl>
              </div>
            )}
          </div>
        </section>

        {!panVerified && (
          <p className="note">Verify the vendor&apos;s PAN above to continue filling the case.</p>
        )}

        {panVerified && (
          <>
            <section className="card">
              <h2>Bank details</h2>
              <div className="grid2">
                <label>
                  Bank account no.
                  <input
                    value={f.bankAccount}
                    onChange={(e) => set('bankAccount', e.target.value)}
                  />
                </label>
                <label>
                  IFSC code
                  <input
                    value={f.ifsc}
                    onChange={(e) => set('ifsc', e.target.value.toUpperCase())}
                    placeholder="HDFC0001234"
                    maxLength={11}
                    className={ifscErr ? 'is-invalid' : ''}
                  />
                  {ifscErr ? (
                    <span className="field-err">{ifscErr}</span>
                  ) : ifscBusy ? (
                    <span className="field-hint">Looking up bank…</span>
                  ) : ifscNote ? (
                    <span className="field-hint">{ifscNote}</span>
                  ) : null}
                </label>
                <label>
                  Bank name
                  <input
                    value={f.bankName}
                    onChange={(e) => set('bankName', e.target.value)}
                    placeholder="Auto-filled from IFSC"
                  />
                </label>
                <label>
                  Branch
                  <input
                    value={f.branch}
                    onChange={(e) => set('branch', e.target.value)}
                    placeholder="Auto-filled from IFSC"
                  />
                </label>

                <div className="span2 row-actions">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={verifyBank}
                    disabled={
                      bankChk.loading ||
                      !/^\d{5,20}$/.test(f.bankAccount.replace(/\s+/g, '')) ||
                      !validateIfsc(f.ifsc.trim().toUpperCase()).valid
                    }
                  >
                    {bankChk.loading ? 'Verifying account…' : 'Verify account'}
                  </button>
                </div>

                {bankChk.result && !bankChk.result.verified && bankChk.result.message ? (
                  <div className="span2 namematch namematch--warn">{bankChk.result.message}</div>
                ) : null}

                {bankChk.result?.verified && bankChk.result.details && (
                  <div className="span2 panbox">
                    <div className="panbox__head">
                      <span
                        className={`pill ${bankChk.result.details.active ? 'pill--ok' : 'pill--warn'}`}
                      >
                        Account {bankChk.result.details.active ? 'active' : 'inactive'}
                      </span>
                      <span className="muted">
                        {bankChk.result.details.ifsc} · penny-less verification
                      </span>
                    </div>
                    <dl className="panbox__grid">
                      <Detail
                        label="Account holder name"
                        value={bankChk.result.details.holderName}
                      />
                      <Detail label="Account number" value={bankChk.result.details.accountNumber} />
                      <Detail label="IFSC" value={bankChk.result.details.ifsc} />
                      <Detail
                        label="Active status"
                        value={
                          bankChk.result.details.active === true
                            ? 'Active'
                            : bankChk.result.details.active === false
                              ? 'Inactive'
                              : (bankChk.result.details.activeStatus ?? 'Unknown')
                        }
                      />
                    </dl>
                    {bankChk.result.nameMatch && (
                      <div
                        className={`namematch ${bankChk.result.nameMatch.matched ? 'namematch--ok' : 'namematch--warn'}`}
                      >
                        {bankChk.result.nameMatch.matched ? (
                          <>
                            Holder name matches the {bankChk.result.nameMatch.matchedAgainst} (
                            {bankChk.result.nameMatch.score}%).
                          </>
                        ) : (
                          <>
                            Holder name does <strong>not</strong> match (best{' '}
                            {bankChk.result.nameMatch.score}% vs{' '}
                            {bankChk.result.nameMatch.matchedAgainst ?? 'PAN/legal/trade name'}). At
                            least 80% is required — confirm the account belongs to the vendor.
                          </>
                        )}
                      </div>
                    )}
                    {bankChk.result.nameMatch === undefined && (
                      <div className="namematch namematch--warn">
                        Verify the PAN or GST first so the holder name can be matched against the
                        vendor&apos;s name.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <h2>Authorized signatory</h2>
              <p className="section-intro">
                The person legally authorised to sign on behalf of the vendor.
              </p>
              <div className="grid2">
                <label>
                  Name (as per Aadhaar)
                  <input
                    value={f.signatoryName}
                    onChange={(e) => set('signatoryName', e.target.value)}
                    placeholder="Full name as on Aadhaar"
                  />
                </label>
                <label>
                  PAN No.
                  <input
                    value={f.signatoryPan}
                    onChange={(e) => set('signatoryPan', e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className={sigPanErr ? 'is-invalid' : ''}
                  />
                  {sigPanErr ? <span className="field-err">{sigPanErr}</span> : null}
                </label>
                <label>
                  Mobile No.
                  <input
                    value={f.signatoryMobile}
                    onChange={(e) =>
                      set('signatoryMobile', e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                    placeholder="9876543210"
                    inputMode="numeric"
                    maxLength={10}
                    className={sigMobileErr ? 'is-invalid' : ''}
                  />
                  {sigMobileErr ? <span className="field-err">{sigMobileErr}</span> : null}
                </label>
                <label>
                  Email ID
                  <input
                    type="email"
                    value={f.signatoryEmail}
                    onChange={(e) => set('signatoryEmail', e.target.value)}
                    placeholder="name@company.com"
                    className={sigEmailErr ? 'is-invalid' : ''}
                  />
                  {sigEmailErr ? <span className="field-err">{sigEmailErr}</span> : null}
                </label>
              </div>
            </section>

            <section className="card">
              <h2>Business SPOC</h2>
              <p className="section-intro">
                Single point of contact at the vendor for this onboarding.
              </p>
              <label className="checkbox" style={{ marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={spocSame}
                  onChange={(e) => setSpocSame(e.target.checked)}
                />
                Same as authorised signatory
              </label>
              <div className="grid2">
                <label>
                  SPOC name
                  <input
                    value={f.contactName}
                    disabled={spocSame}
                    onChange={(e) => set('contactName', e.target.value)}
                  />
                </label>
                <label>
                  SPOC email
                  <input
                    type="email"
                    value={f.contactEmail}
                    disabled={spocSame}
                    onChange={(e) => set('contactEmail', e.target.value)}
                  />
                </label>
                <label>
                  SPOC phone
                  <input
                    value={f.contactPhone}
                    disabled={spocSame}
                    onChange={(e) => set('contactPhone', e.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="card">
              <h2>Information security</h2>
              <p className="section-intro">
                If the vendor needs any IT access or access to systems, network, applications or
                PII, the case is routed to InfoSec for review before it proceeds.
              </p>
              <div className="qlist">
                {INFOSEC_QUESTIONS.map((q) => {
                  const val = (f as unknown as Record<string, string>)[q.key];
                  return (
                    <div key={q.key} className="qrow">
                      <span className="qrow__label">{q.label}</span>
                      <div className="qrow__opts">
                        <label className="radio">
                          <input
                            type="radio"
                            name={q.key}
                            checked={val === 'yes'}
                            onChange={() => set(q.key as keyof typeof f, 'yes')}
                          />
                          Yes
                        </label>
                        <label className="radio">
                          <input
                            type="radio"
                            name={q.key}
                            checked={val === 'no'}
                            onChange={() => set(q.key as keyof typeof f, 'no')}
                          />
                          No
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              {infosecWillRoute && (
                <div className="namematch namematch--warn" style={{ marginTop: 14 }}>
                  Based on these answers, this case will be routed to{' '}
                  <strong>InfoSec review</strong> and held until they sign off.
                </div>
              )}
            </section>

            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Submitting…' : 'Raise case'}
            </button>
          </>
        )}
      </form>
    </main>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="panbox__item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

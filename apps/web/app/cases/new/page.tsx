'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../../lib/api';

interface Category {
  key: string;
  name: string;
  enhancedDueDiligence: boolean;
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
  riskScore: number;
  duplicates: Duplicate[];
}

const OPTS = {
  dataAccess: [
    'No firm or client data',
    'Firm internal data only',
    'Personal data (employee or candidate)',
    'Client confidential data',
    'Regulated / special-category data',
  ],
  systemAccess: ['None', 'Read-only', 'Privileged'],
  yesno: ['No', 'Yes'],
  delivery: ['Onshore', 'Offshore'],
  screening: ['Clear', 'Potential match', 'Confirmed'],
  litigation: ['None', 'Yes — concluded', 'Yes — ongoing'],
  insurance: ['Adequate', 'None'],
  certifications: ['None', 'ISO 27001', 'SOC 2 Type II', 'ISO 27001 + SOC 2 Type II', 'PCI DSS'],
};

const initial = {
  categoryKey: '',
  legalName: '',
  tradeName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  pan: '',
  gstin: '',
  ifsc: '',
  bankAccount: '',
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
};

export default function NewCase() {
  const [cats, setCats] = useState<Category[]>([]);
  const [f, setF] = useState({ ...initial });
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const set = (k: keyof typeof initial, v: string | boolean) =>
    setF((prev) => ({ ...prev, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...f };
      payload.spend = f.spend ? Number(f.spend) : undefined;
      payload.contractMonths = f.contractMonths ? Number(f.contractMonths) : undefined;
      for (const k of [
        'tradeName',
        'contactName',
        'contactEmail',
        'contactPhone',
        'pan',
        'gstin',
        'ifsc',
        'bankAccount',
        'businessUnit',
        'costCentre',
        'natureOfService',
        'coiDetails',
      ])
        if (!payload[k]) delete payload[k];
      const res = await apiFetch<CreateResult>('/cases', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <main className="wrap narrow">
        <h1>Case raised</h1>
        <p className="lead">
          <strong>{result.ref}</strong> · risk tier <span className="pill">{result.tier}</span>{' '}
          (score {result.riskScore})
        </p>
        {result.duplicates.length > 0 && (
          <div className="card" style={{ borderLeft: '3px solid #f87171' }}>
            <strong>Possible duplicates ({result.duplicates.length})</strong>
            <ul>
              {result.duplicates.map((d, i) => (
                <li key={i}>
                  {d.field} matches <code>{d.ref}</code> — {d.legalName}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="req__actions">
          <a className="btn" href={`/cases/${result.id}`}>
            Open case
          </a>
          <a className="btn btn--ghost" href="/cases">
            All cases
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <p className="crumbs">
        <a href="/cases">← Cases</a>
      </p>
      <h1>Raise a vendor onboarding case</h1>
      <p className="lead">
        Enter the vendor details on their behalf. The risk tier is computed on submit.
      </p>
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
              Category
              <select
                value={f.categoryKey}
                onChange={(e) => set('categoryKey', e.target.value)}
                required
              >
                {cats.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                    {c.enhancedDueDiligence ? ' (enhanced DD)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Legal name
              <input
                value={f.legalName}
                onChange={(e) => set('legalName', e.target.value)}
                required
              />
            </label>
            <label>
              Trade name
              <input value={f.tradeName} onChange={(e) => set('tradeName', e.target.value)} />
            </label>
            <label>
              Contact name
              <input value={f.contactName} onChange={(e) => set('contactName', e.target.value)} />
            </label>
            <label>
              Contact email
              <input
                type="email"
                value={f.contactEmail}
                onChange={(e) => set('contactEmail', e.target.value)}
              />
            </label>
            <label>
              Contact phone
              <input value={f.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Statutory & bank</h2>
          <div className="grid2">
            <label>
              PAN
              <input
                value={f.pan}
                onChange={(e) => set('pan', e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
              />
            </label>
            <label>
              GSTIN
              <input
                value={f.gstin}
                onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                placeholder="27ABCDE1234F1Z5"
              />
            </label>
            <label>
              IFSC
              <input
                value={f.ifsc}
                onChange={(e) => set('ifsc', e.target.value.toUpperCase())}
                placeholder="HDFC0001234"
              />
            </label>
            <label>
              Bank account no.
              <input value={f.bankAccount} onChange={(e) => set('bankAccount', e.target.value)} />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Engagement</h2>
          <div className="grid2">
            <label>
              Business unit
              <input value={f.businessUnit} onChange={(e) => set('businessUnit', e.target.value)} />
            </label>
            <label>
              Cost centre
              <input value={f.costCentre} onChange={(e) => set('costCentre', e.target.value)} />
            </label>
            <label>
              Annual spend (USD)
              <input type="number" value={f.spend} onChange={(e) => set('spend', e.target.value)} />
            </label>
            <label>
              Contract months
              <input
                type="number"
                value={f.contractMonths}
                onChange={(e) => set('contractMonths', e.target.value)}
              />
            </label>
            <label className="span2">
              Nature of goods/services
              <input
                value={f.natureOfService}
                onChange={(e) => set('natureOfService', e.target.value)}
              />
            </label>
            <label className="span2">
              Business justification
              <textarea
                value={f.justification}
                onChange={(e) => set('justification', e.target.value)}
                required
                rows={2}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={f.coiDeclared}
                onChange={(e) => set('coiDeclared', e.target.checked)}
              />
              Related-party / conflict of interest
            </label>
            {f.coiDeclared && (
              <label>
                COI details
                <input value={f.coiDetails} onChange={(e) => set('coiDetails', e.target.value)} />
              </label>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Risk & due diligence</h2>
          <div className="grid2">
            <label>
              Data access
              <select value={f.dataAccess} onChange={(e) => set('dataAccess', e.target.value)}>
                {OPTS.dataAccess.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              System access
              <select value={f.systemAccess} onChange={(e) => set('systemAccess', e.target.value)}>
                {OPTS.systemAccess.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Subcontracted
              <select value={f.subcontract} onChange={(e) => set('subcontract', e.target.value)}>
                {OPTS.yesno.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Delivery
              <select value={f.delivery} onChange={(e) => set('delivery', e.target.value)}>
                {OPTS.delivery.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Screening
              <select value={f.screening} onChange={(e) => set('screening', e.target.value)}>
                {OPTS.screening.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Conflict disclosed
              <select value={f.conflict} onChange={(e) => set('conflict', e.target.value)}>
                {OPTS.yesno.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Litigation
              <select value={f.litigation} onChange={(e) => set('litigation', e.target.value)}>
                {OPTS.litigation.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Insurance
              <select value={f.insurance} onChange={(e) => set('insurance', e.target.value)}>
                {OPTS.insurance.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Certifications
              <select
                value={f.certifications}
                onChange={(e) => set('certifications', e.target.value)}
              >
                {OPTS.certifications.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Submitting…' : 'Raise case'}
        </button>
      </form>
    </main>
  );
}

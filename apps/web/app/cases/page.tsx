'use client';
import Link from 'next/link';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '../../lib/api';

interface CaseRow {
  id: string;
  ref: string;
  legalName: string;
  categoryKey: string;
  stage: string;
  tier: string;
  onHold: boolean;
  infosecRequired: boolean;
  dueAt: string | null;
  createdAt: string;
}

export default function Cases() {
  return (
    <Suspense fallback={<main className="wrap" />}>
      <CasesInner />
    </Suspense>
  );
}

function CasesInner() {
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const stageFilter = useSearchParams()?.get('stage') ?? '';

  const load = useCallback(async () => {
    try {
      const qs = stageFilter ? `?stage=${encodeURIComponent(stageFilter)}` : '';
      setRows(await apiFetch<CaseRow[]>(`/cases${qs}`));
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Failed to load.');
    }
  }, [stageFilter]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="wrap">
      <div className="topbar">
        <div>
          <h1>{stageFilter === 'infosec' ? 'InfoSec queue' : 'Cases'}</h1>
          <p className="lead">
            {stageFilter === 'infosec'
              ? `Cases awaiting InfoSec review · ${rows.length}.`
              : `Vendor onboarding cases · ${rows.length}.`}
          </p>
        </div>
        {stageFilter !== 'infosec' && (
          <Link className="btn" href="/cases/new">
            + Raise a case
          </Link>
        )}
      </div>
      {msg && <p className="note">{msg}</p>}

      <section className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Vendor</th>
              <th>Category</th>
              <th>Stage</th>
              <th>Tier</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/cases/${c.id}`}>
                    <code>{c.ref}</code>
                  </Link>
                </td>
                <td>{c.legalName}</td>
                <td className="muted">{c.categoryKey}</td>
                <td>
                  <span className="pill">
                    {c.stage}
                    {c.onHold ? ' · hold' : ''}
                  </span>
                  {c.infosecRequired && (
                    <span className="pill pill--warn" style={{ marginLeft: 6 }}>
                      InfoSec
                    </span>
                  )}
                </td>
                <td>
                  <span className={`pill tier--${c.tier}`}>{c.tier}</span>
                </td>
                <td className="muted">{c.dueAt ? new Date(c.dueAt).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No cases yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

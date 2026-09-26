'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface CaseRow {
  id: string;
  ref: string;
  legalName: string;
  categoryKey: string;
  stage: string;
  tier: string;
  onHold: boolean;
  dueAt: string | null;
  createdAt: string;
}

export default function Cases() {
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await apiFetch<CaseRow[]>('/cases'));
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Failed to load.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="wrap">
      <p className="crumbs">
        <a href="/console">← Console</a>
      </p>
      <div className="topbar">
        <div>
          <h1>Cases</h1>
          <p className="lead">Vendor onboarding cases — {rows.length}.</p>
        </div>
        <a className="btn" href="/cases/new">
          + Raise a case
        </a>
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
                  <a href={`/cases/${c.id}`}>
                    <code>{c.ref}</code>
                  </a>
                </td>
                <td>{c.legalName}</td>
                <td className="muted">{c.categoryKey}</td>
                <td>
                  <span className="pill">
                    {c.stage}
                    {c.onHold ? ' · hold' : ''}
                  </span>
                </td>
                <td>
                  <span className={`pill tier--${c.tier}`}>{c.tier}</span>
                </td>
                <td className="muted">{c.dueAt ? new Date(c.dueAt).toLocaleDateString() : '—'}</td>
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

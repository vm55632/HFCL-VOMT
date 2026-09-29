'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface Row {
  nameMatchVerdict: string | null;
  redFlags: { key: string; severity: string }[];
  case: { id: string; ref: string; legalName: string; stage: string; tier: string };
}

export default function ReviewQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await apiFetch<Row[]>('/review-queue'));
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
        <a href="/console">← Console</a> · <a href="/cases">Cases</a>
      </p>
      <h1>Manual review queue</h1>
      <p className="lead">Cases flagged by verification — {rows.length}.</p>
      {msg && <p className="note">{msg}</p>}

      <section className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Vendor</th>
              <th>Stage</th>
              <th>Tier</th>
              <th>Name match</th>
              <th>Red flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.case.id}>
                <td>
                  <a href={`/cases/${r.case.id}`}>
                    <code>{r.case.ref}</code>
                  </a>
                </td>
                <td>{r.case.legalName}</td>
                <td>
                  <span className="pill">{r.case.stage}</span>
                </td>
                <td>
                  <span className={`pill tier--${r.case.tier}`}>{r.case.tier}</span>
                </td>
                <td>
                  <span className="pill">{r.nameMatchVerdict ?? '—'}</span>
                </td>
                <td>
                  {r.redFlags.length === 0
                    ? '—'
                    : r.redFlags.map((f) => (
                        <span
                          key={f.key}
                          className={`pill tier--${f.severity === 'high' ? 'critical' : 'medium'} tiny`}
                        >
                          {f.key}
                        </span>
                      ))}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Nothing awaiting review.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

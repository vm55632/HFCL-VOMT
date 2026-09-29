'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError, API_BASE } from '../../lib/api';

interface AuditRow {
  seq: string;
  at: string;
  actorId: string | null;
  actorRole: string | null;
  ip: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  outcome: string;
  detail: unknown;
}

export default function Audit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [chain, setChain] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMsg(null);
    try {
      const q = new URLSearchParams();
      if (action) q.set('action', action);
      if (entityType) q.set('entityType', entityType);
      const res = await apiFetch<{ rows: AuditRow[]; total: number }>(`/audit?${q.toString()}`);
      setRows(res.rows);
      setTotal(res.total);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Failed to load.');
    }
  }, [action, entityType]);
  useEffect(() => {
    void load();
  }, [load]);

  async function verify() {
    try {
      const v = await apiFetch<{ valid: boolean; brokenAt?: string; reason?: string }>(
        '/audit/verify',
      );
      setChain(
        v.valid
          ? '✓ Hash chain verified — no tampering detected.'
          : `✗ Chain broken at ${v.brokenAt}: ${v.reason}`,
      );
    } catch (err) {
      setChain(err instanceof Error ? err.message : 'Verify failed.');
    }
  }

  const exportUrl = `${API_BASE}/audit/export.csv?${new URLSearchParams({ ...(action ? { action } : {}), ...(entityType ? { entityType } : {}) }).toString()}`;

  return (
    <main className="wrap">
      <p className="crumbs">
        <a href="/console">← Console</a>
      </p>
      <h1>Audit trail</h1>
      <p className="lead">
        Append-only, hash-chained security &amp; decision log — {total} entries match.
      </p>
      {msg && <p className="error">{msg}</p>}

      <section className="card">
        <div className="req__actions">
          <input
            placeholder="action (e.g. case.)"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">any entity</option>
            {[
              'Case',
              'Document',
              'User',
              'RegistrationRequest',
              'WorkflowDefinition',
              'VendorCategory',
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <button className="btn btn--sm" onClick={() => void load()}>
            Search
          </button>
          <button className="btn btn--sm btn--ghost" onClick={() => void verify()}>
            Verify chain
          </button>
          <a className="btn btn--sm btn--ghost" href={exportUrl}>
            Export CSV
          </a>
        </div>
        {chain && (
          <p className="note" role="status">
            {chain}
          </p>
        )}
      </section>

      <section className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.seq}>
                <td className="muted">{r.seq}</td>
                <td className="muted tiny">{new Date(r.at).toLocaleString()}</td>
                <td className="tiny">{r.actorRole ?? r.actorId ?? '—'}</td>
                <td>
                  <code>{r.action}</code>
                </td>
                <td className="muted tiny">{r.entityType ? `${r.entityType}` : '—'}</td>
                <td>
                  <span className={`pill ${r.outcome === 'SUCCESS' ? 'pill--ok' : ''}`}>
                    {r.outcome}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

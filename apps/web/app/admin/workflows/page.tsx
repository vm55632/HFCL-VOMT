'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '../../../lib/api';

interface Stage {
  key: string;
  name: string;
  shortName: string;
  order: number;
  ownerRole: string | null;
  slaBusinessDays: number;
  terminal: boolean;
  applicableTiers: string[];
  evidenceGate: boolean;
}
interface Workflow {
  id: string;
  key: string;
  name: string;
  version: number;
  status: string;
  rejectStageKey: string;
  stages: Stage[];
}

export default function WorkflowsAdmin() {
  const router = useRouter();
  const [rows, setRows] = useState<Workflow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await apiFetch<Workflow[]>('/workflows'));
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Failed to load.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function newDraftFrom(key: string) {
    setMsg(null);
    try {
      const published = await apiFetch<Workflow>(`/workflows/published/${key}`);
      const created = await apiFetch<Workflow>('/workflows', {
        method: 'POST',
        body: JSON.stringify({
          key: published.key,
          name: published.name,
          rejectStageKey: published.rejectStageKey,
          stages: published.stages.map((s) => ({
            key: s.key,
            name: s.name,
            shortName: s.shortName,
            order: s.order,
            ownerRole: s.ownerRole,
            slaBusinessDays: s.slaBusinessDays,
            terminal: s.terminal,
            applicableTiers: s.applicableTiers,
            evidenceGate: s.evidenceGate,
          })),
        }),
      });
      router.push(`/admin/workflows/${created.id}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not create draft.');
    }
  }

  const badge = (s: string) =>
    ({ DRAFT: 'pill pill--draft', PUBLISHED: 'pill pill--ok', ARCHIVED: 'pill' })[s] ?? 'pill';

  return (
    <main className="wrap">
      <p className="crumbs">
        <a href="/console">← Console</a> · <a href="/admin/categories">Categories</a>
      </p>
      <h1>Workflows</h1>
      <p className="lead">Versioned workflow definitions. Published versions are immutable.</p>
      {msg && (
        <p className="note" role="status">
          {msg}
        </p>
      )}

      <section className="card">
        <button className="btn btn--sm" onClick={() => void newDraftFrom('standard-vendor')}>
          New draft from “standard-vendor”
        </button>
      </section>

      <section className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Version</th>
              <th>Status</th>
              <th>Stages</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td>
                  <code>{w.key}</code>
                </td>
                <td>v{w.version}</td>
                <td>
                  <span className={badge(w.status)}>{w.status}</span>
                </td>
                <td>{w.stages.length}</td>
                <td>
                  <a className="btn btn--sm btn--ghost" href={`/admin/workflows/${w.id}`}>
                    Open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

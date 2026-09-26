'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '../../../../lib/api';

const TIERS = ['low', 'medium', 'high', 'critical'] as const;
const ROLE_OPTIONS = ['proposer', 'procurement', 'compliance', 'finance', 'approver'];

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

export default function WorkflowDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [wf, setWf] = useState<Workflow | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [preview, setPreview] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const w = await apiFetch<Workflow>(`/workflows/${id}`);
      setWf(w);
      setStages(w.stages.map((s) => ({ ...s })));
      setPreview(await apiFetch<Record<string, string[]>>(`/workflows/${id}/preview`));
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Failed to load.');
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const isDraft = wf?.status === 'DRAFT';

  function patchStage(i: number, patch: Partial<Stage>) {
    setStages((prev) => prev.map((s, j) => (i === j ? { ...s, ...patch } : s)));
  }
  function toggleTier(i: number, tier: string) {
    setStages((prev) =>
      prev.map((s, j) => {
        if (j !== i) return s;
        const has = s.applicableTiers.includes(tier);
        return {
          ...s,
          applicableTiers: has
            ? s.applicableTiers.filter((t) => t !== tier)
            : [...s.applicableTiers, tier],
        };
      }),
    );
  }
  function addStage() {
    const order = (stages.length ? Math.max(...stages.map((s) => s.order)) : 0) + 10;
    setStages([
      ...stages,
      {
        key: `stage_${order}`,
        name: 'New stage',
        shortName: 'New',
        order,
        ownerRole: 'procurement',
        slaBusinessDays: 2,
        terminal: false,
        applicableTiers: [],
        evidenceGate: false,
      },
    ]);
  }
  function removeStage(i: number) {
    setStages(stages.filter((_, j) => j !== i));
  }

  async function save() {
    if (!wf) return;
    setMsg(null);
    try {
      await apiFetch(`/workflows/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          key: wf.key,
          name: wf.name,
          rejectStageKey: wf.rejectStageKey,
          stages,
        }),
      });
      setMsg('Draft saved.');
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed.');
    }
  }
  async function act(path: string, label: string) {
    setMsg(null);
    try {
      await apiFetch(`/workflows/${id}/${path}`, { method: 'POST' });
      setMsg(`${label}.`);
      if (path === 'archive') router.push('/admin/workflows');
      else await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : `${label} failed.`);
    }
  }

  if (!wf) return <main className="wrap">{msg ? <p className="error">{msg}</p> : 'Loading…'}</main>;

  return (
    <main className="wrap">
      <p className="crumbs">
        <a href="/admin/workflows">← Workflows</a>
      </p>
      <div className="topbar">
        <div>
          <h1>{wf.name}</h1>
          <p className="lead">
            <code>{wf.key}</code> · v{wf.version} · <span className="pill">{wf.status}</span>
          </p>
        </div>
        <div className="req__actions">
          {isDraft && (
            <button className="btn btn--sm" onClick={() => void save()}>
              Save draft
            </button>
          )}
          {isDraft && (
            <button className="btn btn--sm" onClick={() => void act('publish', 'Published')}>
              Publish
            </button>
          )}
          {wf.status !== 'ARCHIVED' && (
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => void act('archive', 'Archived')}
            >
              Archive
            </button>
          )}
        </div>
      </div>
      {msg && (
        <p className="note" role="status">
          {msg}
        </p>
      )}

      <section className="card">
        <h2>Route preview (by risk tier)</h2>
        {TIERS.map((t) => (
          <p key={t} className="route">
            <strong>{t}</strong>: {(preview[t] ?? []).join(' → ')}
          </p>
        ))}
      </section>

      <section className="card">
        <h2>
          Stages{' '}
          {isDraft && (
            <button className="btn btn--sm btn--ghost" onClick={addStage}>
              + Add stage
            </button>
          )}
        </h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>Order</th>
              <th>Name</th>
              <th>Owner</th>
              <th>SLA</th>
              <th>Tiers</th>
              <th>Gate</th>
              <th>Terminal</th>
              {isDraft && <th />}
            </tr>
          </thead>
          <tbody>
            {stages.map((s, i) => (
              <tr key={i}>
                <td>
                  {isDraft ? (
                    <input
                      className="num"
                      type="number"
                      value={s.order}
                      onChange={(e) => patchStage(i, { order: Number(e.target.value) })}
                    />
                  ) : (
                    s.order
                  )}
                </td>
                <td>
                  {isDraft ? (
                    <input
                      value={s.name}
                      onChange={(e) => patchStage(i, { name: e.target.value })}
                    />
                  ) : (
                    s.name
                  )}
                  <div className="muted">{s.key}</div>
                </td>
                <td>
                  {isDraft ? (
                    <select
                      value={s.ownerRole ?? ''}
                      onChange={(e) => patchStage(i, { ownerRole: e.target.value || null })}
                    >
                      <option value="">— none —</option>
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    (s.ownerRole ?? '—')
                  )}
                </td>
                <td>
                  {isDraft ? (
                    <input
                      className="num"
                      type="number"
                      value={s.slaBusinessDays}
                      onChange={(e) => patchStage(i, { slaBusinessDays: Number(e.target.value) })}
                    />
                  ) : (
                    s.slaBusinessDays
                  )}
                </td>
                <td className="tiers">
                  {TIERS.map((t) =>
                    isDraft ? (
                      <label key={t} className="tiny">
                        <input
                          type="checkbox"
                          checked={s.applicableTiers.includes(t)}
                          onChange={() => toggleTier(i, t)}
                        />
                        {t[0]}
                      </label>
                    ) : s.applicableTiers.includes(t) ? (
                      <span key={t} className="tiny">
                        {t[0]}
                      </span>
                    ) : null,
                  )}
                  {s.applicableTiers.length === 0 && <span className="muted tiny">all</span>}
                </td>
                <td>
                  <input
                    type="checkbox"
                    disabled={!isDraft}
                    checked={s.evidenceGate}
                    onChange={(e) => patchStage(i, { evidenceGate: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    disabled={!isDraft}
                    checked={s.terminal}
                    onChange={(e) => patchStage(i, { terminal: e.target.checked })}
                  />
                </td>
                {isDraft && (
                  <td>
                    <button className="btn btn--sm btn--ghost" onClick={() => removeStage(i)}>
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!isDraft && (
          <p className="muted">
            Published/archived versions are read-only. Create a new draft version to change the
            workflow.
          </p>
        )}
      </section>
    </main>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, ApiError } from '../../../lib/api';

interface ChecklistItem {
  id: string;
  itemId: string;
  label: string;
  role: string | null;
  done: boolean;
}
interface Comment {
  id: string;
  authorId: string;
  body: string;
  at: string;
}
interface Activity {
  at: string;
  action: string;
  fromStage: string | null;
  toStage: string | null;
  note: string | null;
}
interface CaseDetail {
  id: string;
  ref: string;
  legalName: string;
  tradeName: string | null;
  stage: string;
  tier: string;
  onHold: boolean;
  riskScore: number;
  categoryKey: string;
  vendorCode: string | null;
  pan: string | null;
  gstin: string | null;
  ifsc: string | null;
  bankAccount: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  spend: number;
  justification: string;
  checklist: ChecklistItem[];
  comments: Comment[];
  activity: Activity[];
}

const NEEDS_NOTE = new Set(['return', 'reject', 'hold', 'reopen']);

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<CaseDetail | null>(null);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setC(await apiFetch<CaseDetail>(`/cases/${id}`));
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Failed to load.');
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string) {
    setMsg(null);
    let note: string | undefined;
    if (NEEDS_NOTE.has(action)) {
      note = window.prompt(`Reason for "${action}":`) ?? undefined;
      if (!note) return;
    }
    try {
      await apiFetch(`/cases/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, note }),
      });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Action failed.');
    }
  }
  async function tick(itemId: string, done: boolean) {
    await apiFetch(`/cases/${id}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ itemId, done }),
    }).catch((e) => setMsg(String(e)));
    await load();
  }
  async function addComment() {
    if (!comment.trim()) return;
    await apiFetch(`/cases/${id}/comment`, {
      method: 'POST',
      body: JSON.stringify({ body: comment }),
    }).catch((e) => setMsg(String(e)));
    setComment('');
    await load();
  }

  if (!c) return <main className="wrap">{msg ? <p className="error">{msg}</p> : 'Loading…'}</main>;

  const terminal = c.stage === 'approved' || c.stage === 'rejected';
  const actions =
    c.stage === 'draft'
      ? ['submit']
      : terminal
        ? c.stage === 'rejected'
          ? ['reopen']
          : []
        : c.onHold
          ? ['resume']
          : ['advance', 'return', 'reject', 'hold'];
  const openItems = c.checklist.filter((i) => !i.done).length;

  return (
    <main className="wrap">
      <p className="crumbs">
        <a href="/cases">← Cases</a>
      </p>
      <div className="topbar">
        <div>
          <h1>{c.legalName}</h1>
          <p className="lead">
            <code>{c.ref}</code> · <span className={`pill tier--${c.tier}`}>{c.tier}</span> · stage{' '}
            <span className="pill">
              {c.stage}
              {c.onHold ? ' · hold' : ''}
            </span>
            {c.vendorCode && (
              <>
                {' '}
                · vendor <code>{c.vendorCode}</code>
              </>
            )}
          </p>
        </div>
        <div className="req__actions">
          {actions.map((a) => (
            <button
              key={a}
              className={`btn btn--sm${a === 'reject' ? ' btn--ghost' : ''}`}
              onClick={() => void act(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      {msg && (
        <p className="note" role="status">
          {msg}
        </p>
      )}
      {openItems > 0 && !terminal && (
        <p className="note">⚠ {openItems} due-diligence item(s) outstanding (evidence gate).</p>
      )}

      <section className="card">
        <h2>Vendor details</h2>
        <div className="grid2">
          <div>
            PAN <code>{c.pan ?? '—'}</code>
          </div>
          <div>
            GSTIN <code>{c.gstin ?? '—'}</code>
          </div>
          <div>
            IFSC <code>{c.ifsc ?? '—'}</code>
          </div>
          <div>
            Bank a/c <code>{c.bankAccount ?? '—'}</code>
          </div>
          <div>Contact {c.contactEmail ?? '—'}</div>
          <div>Spend USD {c.spend.toLocaleString()}</div>
        </div>
        <p className="muted">
          Category: {c.categoryKey} · risk score {c.riskScore}
        </p>
        <p>{c.justification}</p>
      </section>

      <section className="card">
        <h2>
          Due diligence ({c.checklist.filter((i) => i.done).length}/{c.checklist.length})
        </h2>
        {c.checklist.map((it) => (
          <label
            key={it.id}
            className="checkbox"
            style={{ display: 'flex', gap: 8, padding: '3px 0' }}
          >
            <input
              type="checkbox"
              checked={it.done}
              onChange={(e) => void tick(it.itemId, e.target.checked)}
            />
            <span style={{ textDecoration: it.done ? 'line-through' : 'none' }}>{it.label}</span>
            {it.role && <span className="muted tiny">{it.role}</span>}
          </label>
        ))}
      </section>

      <section className="card">
        <h2>Activity</h2>
        <ul className="timeline">
          {c.activity.map((a, i) => (
            <li key={i}>
              <span className="muted">{new Date(a.at).toLocaleString()}</span> —{' '}
              <strong>{a.action}</strong>
              {a.fromStage && a.toStage && a.fromStage !== a.toStage && (
                <>
                  {' '}
                  ({a.fromStage} → {a.toStage})
                </>
              )}
              {a.note && <> · {a.note}</>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Comments</h2>
        {c.comments.map((m) => (
          <p key={m.id}>
            <span className="muted">{new Date(m.at).toLocaleString()}</span> — {m.body}
          </p>
        ))}
        <div className="req__actions">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment…"
            style={{ flex: 1 }}
          />
          <button className="btn btn--sm" onClick={() => void addComment()}>
            Post
          </button>
        </div>
      </section>
    </main>
  );
}

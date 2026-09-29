'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, ApiError, API_BASE } from '../../../lib/api';

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
interface Doc {
  id: string;
  docType: string;
  filename: string;
  fileType: string;
  sizeBytes: number;
  sha256: string;
  status: string;
  version: number;
  createdAt: string;
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
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docType, setDocType] = useState('pan_card');
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setC(await apiFetch<CaseDetail>(`/cases/${id}`));
      setDocs(await apiFetch<Doc[]>(`/cases/${id}/documents`));
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Failed to load.');
    }
  }, [id]);

  async function uploadDoc(file: File) {
    setMsg(null);
    const form = new FormData();
    form.append('file', file);
    form.append('docType', docType);
    const res = await fetch(`${API_BASE}/cases/${id}/documents`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(b.error ?? `Upload failed (${res.status})`);
    } else {
      setMsg('Document uploaded (scanned clean).');
    }
    await load();
  }
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
        <h2>Documents ({docs.length})</h2>
        <div className="req__actions">
          <select value={docType} onChange={(e) => setDocType(e.target.value)}>
            {[
              'pan_card',
              'gst_certificate',
              'cancelled_cheque',
              'insurance',
              'tax_residency_certificate',
              'related_party_declaration',
              'other',
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadDoc(f);
              e.currentTarget.value = '';
            }}
          />
        </div>
        <p className="muted tiny">PDF/JPG/PNG only — validated by content and malware-scanned.</p>
        <table className="tbl">
          <thead>
            <tr>
              <th>Type</th>
              <th>File</th>
              <th>Size</th>
              <th>SHA-256</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.docType} <span className="muted tiny">v{d.version}</span>
                </td>
                <td>{d.filename}</td>
                <td className="muted">{(d.sizeBytes / 1024).toFixed(0)} KB</td>
                <td className="muted tiny">{d.sha256.slice(0, 12)}…</td>
                <td>
                  <span className={d.status === 'CLEAN' ? 'pill pill--ok' : 'pill'}>
                    {d.status}
                  </span>
                </td>
                <td>
                  <a
                    className="btn btn--sm btn--ghost"
                    href={`${API_BASE}/cases/${id}/documents/${d.id}/download`}
                  >
                    Download
                  </a>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No documents.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

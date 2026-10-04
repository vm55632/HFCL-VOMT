'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError, API_BASE } from '../../../lib/api';
import { SkeletonLines } from '../../../components/Skeleton';
import ParallelReview from '../../../components/ParallelReview';

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
  createdById: string;
  legalName: string;
  tradeName: string | null;
  businessAddress: string | null;
  stage: string;
  tier: string;
  onHold: boolean;
  infosecRequired: boolean;
  isecItHardware: boolean;
  isecItSoftware: boolean;
  isecAccessSystem: boolean;
  isecAccessNetwork: boolean;
  isecAccessApps: boolean;
  isecAccessPii: boolean;
  riskScore: number;
  categoryKey: string;
  vendorCode: string | null;
  vendorStatus: string;
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
  stages?: Record<string, StageRow | null>;
  reviewStages?: string[];
}
interface StageRow {
  status: string;
  decision: string | null;
  remark: string | null;
  actionedById: string | null;
  actionedByName?: string | null;
  enteredAt: string | null;
  completedAt: string | null;
  data?: { agreement?: string } | null;
}
interface CrossCheck {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
}
interface RedFlag {
  key: string;
  severity: string;
  message: string;
}
interface Verification {
  panStatus: string | null;
  gstStatus: string | null;
  bankStatus: string | null;
  gstLegalName: string | null;
  nameMatchScore: number | null;
  nameMatchVerdict: string | null;
  crossChecks: CrossCheck[];
  redFlags: RedFlag[];
  reviewRequired: boolean;
  verifiedAt: string;
}

const NEEDS_NOTE = new Set(['return', 'reject', 'hold', 'reopen']);

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<CaseDetail | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [ver, setVer] = useState<Verification | null>(null);
  const [docType, setDocType] = useState('pan_card');
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [meId, setMeId] = useState<string>('');
  const [agreement, setAgreement] = useState('');

  const load = useCallback(async () => {
    try {
      setC(await apiFetch<CaseDetail>(`/cases/${id}`));
      setDocs(await apiFetch<Doc[]>(`/cases/${id}/documents`));
      setVer(await apiFetch<Verification | null>(`/cases/${id}/verification`));
      await apiFetch<{ id: string; permissions: string[]; roles: string[] }>('/auth/me')
        .then((m) => {
          setPerms(m.permissions);
          setRoles(m.roles ?? []);
          setMeId(m.id);
        })
        .catch(() => undefined);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Failed to load.');
    }
  }, [id]);

  async function runVerify() {
    setMsg(null);
    try {
      await apiFetch(`/cases/${id}/verify`, { method: 'POST' });
      setMsg('Verification run.');
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Verification failed.');
    }
  }

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

  // A proposer opening their own case that needs their changes (a fresh draft, or a stage sent back
  // to them) goes straight to the editable form pre-filled with what they entered.
  useEffect(() => {
    if (!c || !meId || meId !== c.createdById) return;
    const hasSentBack = (c.reviewStages ?? []).some((s) => c.stages?.[s]?.status === 'sent_back');
    if (c.stage === 'draft' || hasSentBack) {
      router.replace(`/cases/new?id=${c.id}`);
    }
  }, [c, meId, router]);

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
  async function infosecDecision(decision: 'approve' | 'reject' | 'sendback') {
    return stageDecision('infosec', decision);
  }
  async function stageDecision(
    stage: string,
    decision: 'approve' | 'reject' | 'sendback',
    agreement?: string,
  ) {
    let note: string | undefined;
    if (decision !== 'approve') {
      note =
        window.prompt(`Remark for ${decision === 'reject' ? 'rejection' : 'sending back'}:`) ??
        undefined;
      if (!note) return;
    }
    try {
      await apiFetch(`/cases/${id}/stage/${stage}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, note, agreement }),
      });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Action failed.');
    }
  }
  async function sapDecision(decision: 'approve' | 'reject') {
    let note: string | undefined;
    if (decision === 'reject') {
      note = window.prompt('Remark for rejection:') ?? undefined;
      if (!note) return;
    } else if (!window.confirm('Confirm this vendor into SAP/ERP and activate it?')) {
      return;
    }
    try {
      await apiFetch(`/cases/${id}/sap-decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, note }),
      });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Action failed.');
    }
  }
  async function lifecycle(path: 'block' | 'reactivate') {
    const reason = window.prompt(`Reason to ${path}:`);
    if (!reason) return;
    try {
      await apiFetch(`/cases/${id}/${path}`, { method: 'POST', body: JSON.stringify({ reason }) });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Action failed.');
    }
  }

  if (!c)
    return (
      <main className="wrap">
        {msg ? (
          <p className="error">{msg}</p>
        ) : (
          <div className="card">
            <SkeletonLines count={5} />
          </div>
        )}
      </main>
    );

  const STAGE_LABELS: Record<string, string> = {
    infosec: 'InfoSec',
    fcu: 'FCU',
    operation: 'Operation',
    legal: 'Legal',
    sap: 'SAP confirmation',
  };
  const REVIEW_ROLES = ['infosec', 'fcu', 'operation', 'legal'];
  // The one parallel stage this viewer owns and which is awaiting them.
  const myStage = (c.reviewStages ?? []).find(
    (s) => REVIEW_ROLES.includes(s) && roles.includes(s) && c.stages?.[s]?.status === 'pending',
  );
  const isSapReviewer = roles.includes('sap');
  const vendorCard = (
    <section className="card">
      <h2>Vendor</h2>
      <div className="grid2">
        <div>
          Legal name <strong>{c.legalName}</strong>
        </div>
        <div>Trade name {c.tradeName ?? '-'}</div>
        <div className="span2">Business address {c.businessAddress ?? '-'}</div>
        <div>
          GSTIN <code>{c.gstin ?? '-'}</code>
        </div>
        <div>Contact {c.contactEmail ?? '-'}</div>
        <div className="muted">
          Category {c.categoryKey} · tier {c.tier}
        </div>
      </div>
    </section>
  );

  // A parallel reviewer (InfoSec/FCU/Operation/Legal) gets a clean, focused review screen.
  if (myStage) {
    const answers: [string, boolean][] = [
      ['Information Technology — Hardware', c.isecItHardware],
      ['Information Technology — Software', c.isecItSoftware],
      ["Access to HFCL's systems", c.isecAccessSystem],
      ["Access to HFCL's IT network", c.isecAccessNetwork],
      ["Access to HFCL's applications", c.isecAccessApps],
      ['Access to PII (customer / employee / partner)', c.isecAccessPii],
    ];
    return (
      <main className="wrap">
        <p className="crumbs">
          <Link href={`/stages/${myStage}`}>{STAGE_LABELS[myStage]} queue</Link>
        </p>
        <div className="topbar">
          <div>
            <h1>{c.legalName}</h1>
            <p className="lead">
              <code>{c.ref}</code> ·{' '}
              <span className="pill pill--warn">{STAGE_LABELS[myStage]} review</span>
            </p>
          </div>
          <div className="req__actions">
            <button
              className="btn btn--sm"
              onClick={() =>
                void stageDecision(myStage, 'approve', myStage === 'legal' ? agreement : undefined)
              }
            >
              Approve
            </button>
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => void stageDecision(myStage, 'sendback')}
            >
              Send back
            </button>
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => void stageDecision(myStage, 'reject')}
            >
              Reject
            </button>
          </div>
        </div>
        {msg && (
          <p className="note" role="status">
            {msg}
          </p>
        )}

        {vendorCard}

        {myStage === 'infosec' && (
          <section className="card">
            <h2>Access requested</h2>
            <p className="section-intro">Why this case was routed to InfoSec.</p>
            <div className="qlist">
              {answers.map(([label, val]) => (
                <div key={label} className="qrow">
                  <span className="qrow__label">{label}</span>
                  <span className={`pill ${val ? 'pill--warn' : ''}`}>{val ? 'Yes' : 'No'}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {myStage === 'legal' && (
          <section className="card">
            <h2>Draft the agreement</h2>
            <p className="section-intro">
              Draft the vendor agreement text below. It is saved with your approval.
            </p>
            <textarea
              value={agreement}
              onChange={(e) => setAgreement(e.target.value)}
              placeholder="Agreement clauses, terms, special conditions…"
              rows={10}
              style={{ width: '100%' }}
            />
          </section>
        )}
      </main>
    );
  }

  // SAP confirmation — final stage. Shows every parallel stage's completion, then confirms.
  if (isSapReviewer && (c.stage === 'sap' || c.stage === 'approved' || c.stage === 'rejected')) {
    const active = c.reviewStages ?? [];
    const allDone = active.every((s) => c.stages?.[s]?.status === 'approved');
    return (
      <main className="wrap">
        <p className="crumbs">
          <Link href="/stages/sap">SAP confirmation queue</Link>
        </p>
        <div className="topbar">
          <div>
            <h1>{c.legalName}</h1>
            <p className="lead">
              <code>{c.ref}</code> ·{' '}
              <span
                className={`pill ${c.stage === 'approved' ? 'pill--ok' : c.stage === 'rejected' ? 'pill--danger' : 'pill--warn'}`}
              >
                {STAGE_LABELS.sap}: {c.stage}
              </span>
            </p>
          </div>
          {c.stage === 'sap' && (
            <div className="req__actions">
              <button
                className="btn btn--sm"
                disabled={!allDone}
                onClick={() => void sapDecision('approve')}
              >
                Confirm &amp; activate
              </button>
              <button className="btn btn--sm btn--ghost" onClick={() => void sapDecision('reject')}>
                Reject
              </button>
            </div>
          )}
        </div>
        {msg && (
          <p className="note" role="status">
            {msg}
          </p>
        )}

        {vendorCard}

        <ParallelReview
          stages={c.stages ?? {}}
          reviewStages={active}
          caseStage={c.stage}
          canConfirmSap
          onConfirmSap={() => void sapDecision('approve')}
        />

        {c.stages?.legal?.data?.agreement && (
          <section className="card">
            <h2>Legal agreement</h2>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{c.stages.legal.data.agreement}</pre>
          </section>
        )}
      </main>
    );
  }

  const terminal = c.stage === 'approved' || c.stage === 'rejected';
  const reviewStages = c.reviewStages ?? [];
  // Parallel review is driven by the per-stage review screens, so the sequential workflow buttons
  // are only relevant for a legacy/sequential case (not in the review/sap/draft phases).
  const parallelPhase = ['review', 'sap', 'draft'].includes(c.stage);
  const actions = parallelPhase
    ? []
    : terminal
      ? c.stage === 'rejected'
        ? ['reopen']
        : []
      : c.onHold
        ? ['resume']
        : ['advance', 'return', 'reject', 'hold'];
  const openItems = c.checklist.filter((i) => !i.done).length;
  const isOwner = meId !== '' && meId === c.createdById;
  // Stages that a reviewer sent back to the proposer (they need to edit & resubmit those).
  const sentBackStages = reviewStages.filter((s) => c.stages?.[s]?.status === 'sent_back');
  const sentBack = sentBackStages.length > 0;
  const lastReturn = [...c.activity]
    .reverse()
    .find((a) => /_sendback$|^return$|infosec_returned/.test(a.action));
  const canEditDraft = isOwner && (c.stage === 'draft' || sentBack);

  return (
    <main className="wrap">
      <p className="crumbs">
        <Link href="/cases">Cases</Link>
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
          {canEditDraft && (
            <Link className="btn btn--sm" href={`/cases/new?id=${c.id}`}>
              Edit &amp; resubmit
            </Link>
          )}
          {actions.map((a) => (
            <button
              key={a}
              className={`btn btn--sm${a === 'reject' ? ' btn--ghost' : ''}`}
              onClick={() => void act(a)}
            >
              {a}
            </button>
          ))}
          {c.stage === 'approved' && c.vendorStatus === 'ACTIVE' && (
            <button className="btn btn--sm btn--ghost" onClick={() => void lifecycle('block')}>
              block vendor
            </button>
          )}
          {c.stage === 'approved' && c.vendorStatus === 'BLOCKED' && (
            <button className="btn btn--sm" onClick={() => void lifecycle('reactivate')}>
              reactivate
            </button>
          )}
        </div>
      </div>
      {sentBack && (
        <div className="namematch namematch--warn">
          <strong>Changes requested ({sentBackStages.join(', ')}).</strong>{' '}
          {lastReturn?.note || 'A reviewer asked for changes before this case can proceed.'}
          {canEditDraft && (
            <>
              {' '}
              <Link href={`/cases/new?id=${c.id}`}>Edit the case</Link> and resubmit.
            </>
          )}
        </div>
      )}
      {(c.stage === 'review' ||
        c.stage === 'sap' ||
        c.stage === 'approved' ||
        c.stage === 'rejected') &&
        reviewStages.length > 0 && (
          <ParallelReview stages={c.stages ?? {}} reviewStages={reviewStages} caseStage={c.stage} />
        )}
      {c.stage === 'approved' && (
        <p className="note">
          Vendor status:{' '}
          <span className={`pill ${c.vendorStatus === 'ACTIVE' ? 'pill--ok' : 'tier--critical'}`}>
            {c.vendorStatus}
          </span>
        </p>
      )}
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
            Legal name <strong>{c.legalName}</strong>
          </div>
          <div>Trade name {c.tradeName ?? '-'}</div>
          <div className="span2">Business address {c.businessAddress ?? '-'}</div>
          <div>
            GSTIN <code>{c.gstin ?? '-'}</code>
          </div>
          <div>Contact {c.contactEmail ?? '-'}</div>
          <div>
            PAN <code>{c.pan ?? '-'}</code>
          </div>
          <div>
            IFSC <code>{c.ifsc ?? '-'}</code>
          </div>
          <div>
            Bank a/c <code>{c.bankAccount ?? '-'}</code>
          </div>
          <div>Spend USD {c.spend.toLocaleString()}</div>
        </div>
        <p className="muted">
          Category: {c.categoryKey} · risk score {c.riskScore}
        </p>
        {c.justification && <p>{c.justification}</p>}
      </section>

      <section className="card">
        <h2>Statutory verification</h2>
        <div className="req__actions">
          <button className="btn btn--sm" onClick={() => void runVerify()}>
            Run verification
          </button>
          {ver?.reviewRequired && <span className="pill tier--high">manual review</span>}
        </div>
        {!ver && <p className="muted">Not yet verified.</p>}
        {ver && (
          <>
            <div className="grid2">
              <div>
                PAN: <span className="pill">{ver.panStatus ?? '-'}</span>
              </div>
              <div>
                GST: <span className="pill">{ver.gstStatus ?? '-'}</span>
              </div>
              <div>
                Bank: <span className="pill">{ver.bankStatus ?? '-'}</span>
              </div>
              <div>
                Name match: <span className="pill">{ver.nameMatchVerdict ?? '-'}</span>
                {ver.nameMatchScore != null && ` (${ver.nameMatchScore.toFixed(2)})`}
              </div>
            </div>
            <h3>Cross-checks</h3>
            <ul className="timeline">
              {ver.crossChecks.map((x) => (
                <li key={x.key}>
                  <span className={`pill ${x.ok ? 'pill--ok' : 'pill--draft'}`}>
                    {x.ok ? 'Pass' : 'Fail'}
                  </span>{' '}
                  {x.label}
                  {x.detail ? ` · ${x.detail}` : ''}
                </li>
              ))}
            </ul>
            {ver.redFlags.length > 0 && (
              <>
                <h3>Red flags ({ver.redFlags.length})</h3>
                <ul className="timeline">
                  {ver.redFlags.map((f) => (
                    <li key={f.key}>
                      <span
                        className={`pill tier--${f.severity === 'high' ? 'critical' : 'medium'}`}
                      >
                        {f.severity}
                      </span>{' '}
                      {f.message}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
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
        <p className="muted tiny">PDF/JPG/PNG only · validated by content and malware-scanned.</p>
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
              <span className="muted">{new Date(a.at).toLocaleString()}</span>
              {' · '}
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
            <span className="muted">{new Date(m.at).toLocaleString()}</span> · {m.body}
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

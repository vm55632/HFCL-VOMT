'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '../../lib/api';

interface Me {
  id: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  permissions: string[];
}
interface PendingReq {
  id: string;
  requestedRoles: string[];
  justification: string;
  user: { id: string; name: string; email: string; department: string | null };
}
interface UserRow {
  id: string;
  email: string;
  name: string;
  status: string;
  roles: { key: string; label: string }[];
}

export default function Console() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [pending, setPending] = useState<PendingReq[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const profile = await apiFetch<Me>('/auth/me');
      setMe(profile);
      setPending(await apiFetch<PendingReq[]>('/registrations/pending'));
      if (profile.permissions.includes('user:read')) {
        const list = await apiFetch<{ rows: UserRow[] }>('/users?take=100');
        setUsers(list.rows);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/sign-in');
      else setMsg(err instanceof Error ? err.message : 'Failed to load.');
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: 'approve' | 'reject', roles: string[]) {
    setMsg(null);
    try {
      await apiFetch(`/registrations/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, roles }),
      });
      setMsg(`Request ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Action failed.');
    }
  }

  async function forceLogout(id: string) {
    try {
      await apiFetch(`/users/${id}/force-logout`, { method: 'POST' });
      setMsg('Sessions revoked.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Action failed.');
    }
  }

  async function logout() {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/sign-in');
  }

  if (!me) return <main className="wrap">{msg ? <p className="error">{msg}</p> : 'Loading…'}</main>;

  const isAdmin = me.permissions.includes('user:read');

  return (
    <main className="wrap">
      <div className="topbar">
        <div>
          <h1>Console</h1>
          <p className="lead">
            {me.name} · {me.email}
          </p>
        </div>
        <button className="btn btn--ghost" onClick={() => void logout()}>
          Sign out
        </button>
      </div>

      {msg && (
        <p className="note" role="status">
          {msg}
        </p>
      )}

      <section className="card">
        <h2>Your access</h2>
        <p>
          Status: <span className="pill">{me.status}</span>
        </p>
        <p>Roles: {me.roles.length ? me.roles.join(', ') : <em>none</em>}</p>
        <details>
          <summary>{me.permissions.length} permissions</summary>
          <div className="perms">
            {me.permissions.map((p) => (
              <code key={p}>{p}</code>
            ))}
          </div>
        </details>
      </section>

      {(me.permissions.includes('settings:manage') ||
        me.permissions.includes('workflow:manage')) && (
        <section className="card">
          <h2>Administration</h2>
          <div className="adminlinks">
            <a className="btn btn--sm btn--ghost" href="/admin/categories">
              Vendor categories
            </a>
            <a className="btn btn--sm btn--ghost" href="/admin/workflows">
              Workflows
            </a>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Approval inbox ({pending.length})</h2>
        {pending.length === 0 && <p className="muted">No requests awaiting your approval.</p>}
        {pending.map((r) => (
          <div key={r.id} className="req">
            <div>
              <strong>{r.user.name}</strong> <span className="muted">{r.user.email}</span>
              <div className="muted">
                Requests: {r.requestedRoles.join(', ') || '—'} · {r.justification}
              </div>
            </div>
            <div className="req__actions">
              <button
                className="btn btn--sm"
                onClick={() => void decide(r.id, 'approve', r.requestedRoles)}
              >
                Approve
              </button>
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => void decide(r.id, 'reject', [])}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </section>

      {isAdmin && (
        <section className="card">
          <h2>Users ({users.length})</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Roles</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    <div className="muted">{u.email}</div>
                  </td>
                  <td>
                    <span className="pill">{u.status}</span>
                  </td>
                  <td>{u.roles.map((r) => r.label).join(', ') || '—'}</td>
                  <td>
                    {me.permissions.includes('user:force_logout') && (
                      <button
                        className="btn btn--sm btn--ghost"
                        onClick={() => void forceLogout(u.id)}
                      >
                        Force logout
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '../../../lib/api';

// Assignable roles (mirrors @vop/shared RoleKey/labels). Vendor is external-only.
const ROLE_CATALOG: { key: string; label: string }[] = [
  { key: 'super_admin', label: 'Super Admin' },
  { key: 'platform_admin', label: 'Platform Admin' },
  { key: 'proposer', label: 'Proposer' },
  { key: 'approver', label: 'Reviewer / Approver' },
  { key: 'procurement', label: 'Procurement' },
  { key: 'finance', label: 'Finance & Treasury' },
  { key: 'compliance', label: 'Compliance / Legal' },
  { key: 'auditor', label: 'Auditor' },
];

interface UserRow {
  id: string;
  email: string;
  name: string;
  status: string;
  roles: { key: string; label: string }[];
}

export default function RoleManagement() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<{ rows: UserRow[] }>('/users?take=200');
      setUsers(list.rows);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/sign-in');
      else setMsg(err instanceof Error ? err.message : 'Failed to load.');
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => users.find((u) => u.id === selectedId), [users, selectedId]);

  function pick(id: string) {
    setSelectedId(id);
    setMsg(null);
    const u = users.find((x) => x.id === id);
    setChecked(new Set(u?.roles.map((r) => r.key) ?? []));
  }

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(`/users/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ roleKeys: [...checked] }),
      });
      setMsg(`Roles updated for ${selected.name}.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  const dirty =
    !!selected &&
    (checked.size !== selected.roles.length || selected.roles.some((r) => !checked.has(r.key)));

  return (
    <main className="wrap">
      <div className="topbar">
        <div>
          <h1>Role management</h1>
          <p className="lead">Assign roles to users. Authorization is enforced server-side.</p>
        </div>
      </div>

      {msg && (
        <p className="note" role="status">
          {msg}
        </p>
      )}

      <section className="card">
        <label className="field" style={{ maxWidth: 420 }}>
          User
          <select value={selectedId} onChange={(e) => pick(e.target.value)}>
            <option value="">Select a user…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.email}
              </option>
            ))}
          </select>
        </label>

        {selected && (
          <>
            <h3 style={{ marginTop: 18 }}>Roles for {selected.name}</h3>
            <div className="grid2" style={{ marginBottom: 16 }}>
              {ROLE_CATALOG.map((r) => (
                <label key={r.key} className="checkbox">
                  <input
                    type="checkbox"
                    checked={checked.has(r.key)}
                    onChange={() => toggle(r.key)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <button className="btn" onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? 'Saving…' : 'Save roles'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}

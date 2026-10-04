'use client';
import Link from 'next/link';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '../../lib/api';
import { SkeletonLines } from '../../components/Skeleton';

interface Me {
  id: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  permissions: string[];
}

export default function Console() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMe(await apiFetch<Me>('/auth/me'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/sign-in');
      else setMsg(err instanceof Error ? err.message : 'Failed to load.');
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!me)
    return (
      <main className="wrap">
        <h1>My access</h1>
        {msg ? (
          <p className="error">{msg}</p>
        ) : (
          <div className="card">
            <SkeletonLines count={4} />
          </div>
        )}
      </main>
    );

  const can = (p: string) => me.permissions.includes(p);

  return (
    <main className="wrap">
      <div className="topbar">
        <div>
          <h1>My access</h1>
          <p className="lead">
            {me.name} · {me.email}
          </p>
        </div>
        <span className={`pill ${me.status.toLowerCase() === 'active' ? 'pill--ok' : ''}`}>
          {me.status}
        </span>
      </div>

      <section className="card">
        <h2>Profile</h2>
        <p>
          <span className="muted">Roles:</span>{' '}
          {me.roles.length ? me.roles.join(', ') : <em className="muted">none</em>}
        </p>
        <details>
          <summary className="muted">{me.permissions.length} permissions</summary>
          <div className="perms">
            {me.permissions.map((p) => (
              <code key={p}>{p}</code>
            ))}
          </div>
        </details>
      </section>

      <section className="card">
        <h2>Quick actions</h2>
        <div className="adminlinks">
          <Link className="btn btn--sm btn--ghost" href="/dashboard">
            Dashboard
          </Link>
          <Link className="btn btn--sm btn--ghost" href="/cases">
            Cases
          </Link>
          {can('vendor:read_all') && (
            <Link className="btn btn--sm btn--ghost" href="/review-queue">
              Review queue
            </Link>
          )}
          {can('vendor:create') && (
            <Link className="btn btn--sm" href="/cases/new">
              + Raise a case
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}

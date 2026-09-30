'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface Stats {
  scope: string;
  total: number;
  active: number;
  overdue: number;
  reviewRequired: number;
  byStage: { stage: string; count: number }[];
  byTier: { tier: string; count: number }[];
}

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setS(await apiFetch<Stats>('/stats/dashboard'));
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Failed to load.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!s) return <main className="wrap">{msg ? <p className="error">{msg}</p> : 'Loading…'}</main>;
  const maxStage = Math.max(1, ...s.byStage.map((x) => x.count));

  return (
    <main className="wrap">
      <p className="crumbs">
        <a href="/console">← Console</a> · <a href="/cases">Cases</a>
      </p>
      <h1>Dashboard</h1>
      <p className="lead">{s.scope === 'all' ? 'Organisation-wide' : 'Your cases'}.</p>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi__n">{s.total}</span>
          <span className="kpi__l">Total cases</span>
        </div>
        <div className="kpi">
          <span className="kpi__n">{s.active}</span>
          <span className="kpi__l">In flight</span>
        </div>
        <div className="kpi kpi--warn">
          <span className="kpi__n">{s.overdue}</span>
          <span className="kpi__l">Overdue (SLA)</span>
        </div>
        <div className="kpi kpi--flag">
          <span className="kpi__n">{s.reviewRequired}</span>
          <span className="kpi__l">Manual review</span>
        </div>
      </div>

      <section className="card">
        <h2>Pipeline by stage</h2>
        {s.byStage.map((x) => (
          <div key={x.stage} className="bar">
            <span className="bar__label">{x.stage}</span>
            <span className="bar__track">
              <span className="bar__fill" style={{ width: `${(x.count / maxStage) * 100}%` }} />
            </span>
            <span className="bar__val">{x.count}</span>
          </div>
        ))}
        {s.byStage.length === 0 && <p className="muted">No cases.</p>}
      </section>

      <section className="card">
        <h2>By risk tier</h2>
        <div className="adminlinks">
          {s.byTier.map((x) => (
            <span key={x.tier} className={`pill tier--${x.tier}`}>
              {x.tier}: {x.count}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}

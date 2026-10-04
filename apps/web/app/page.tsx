import Link from 'next/link';

const phases = [
  { id: 0, name: 'Foundation' },
  { id: 1, name: 'Identity & Access' },
  { id: 2, name: 'Master data & workflow engine' },
  { id: 3, name: 'Vendor onboarding' },
  { id: 4, name: 'Validations & risk' },
  { id: 5, name: 'Audit, reporting & lifecycle' },
  { id: 6, name: 'Hardening & deployment' },
];

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <span className="brand-mark brand-mark--lg">VOP</span>
        <h1>Vendor Onboarding Platform</h1>
        <p className="lead">
          Security-first, cloud-agnostic vendor onboarding · SSO &amp; RBAC, a versioned workflow
          engine, field-level encryption, risk scoring, red-flag checks and a hash-chained audit
          trail. Built to pass InfoSec review, VAPT and audit.
        </p>
        <div className="hero__cta">
          <Link className="btn" href="/sign-in">
            Sign in
          </Link>
          <Link className="btn btn--ghost" href="/dashboard">
            View dashboard
          </Link>
        </div>
      </section>

      <section aria-label="Delivery phases" className="card">
        <h2>Delivery phases</h2>
        <ul className="phases">
          {phases.map((p) => (
            <li key={p.id} className="phase">
              <span className="phase__num">Phase {p.id}</span>
              <span className="phase__name">{p.name}</span>
              <span className="phase__status">Shipped</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="faint" style={{ fontSize: '0.82rem' }}>
        API health: <code>/api/v1/health/ready</code> · API docs (dev): <code>/api/docs</code>
      </p>
    </main>
  );
}

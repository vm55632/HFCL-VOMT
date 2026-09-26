const phases = [
  { id: 0, name: 'Foundation', status: 'in progress' },
  { id: 1, name: 'Identity & Access', status: 'next' },
  { id: 2, name: 'Master data & workflow engine', status: 'planned' },
  { id: 3, name: 'Vendor onboarding', status: 'planned' },
  { id: 4, name: 'Validations & risk', status: 'planned' },
  { id: 5, name: 'Audit, reporting, lifecycle', status: 'planned' },
  { id: 6, name: 'Hardening & deployment', status: 'planned' },
];

export default function Home() {
  return (
    <main className="wrap">
      <h1>VOP — Vendor Onboarding Platform</h1>
      <p className="lead">
        Security-first, cloud-agnostic (on-prem first) vendor onboarding. This is the Phase 0
        foundation scaffold — identity, workflow and onboarding UIs arrive in later phases.
      </p>

      <section aria-label="Delivery phases">
        <h2>Delivery phases</h2>
        <ul className="phases">
          {phases.map((p) => (
            <li key={p.id} className={`phase phase--${p.status.replace(/\s+/g, '-')}`}>
              <span className="phase__num">Phase {p.id}</span>
              <span className="phase__name">{p.name}</span>
              <span className="phase__status">{p.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="note">
        API health: <code>/api/v1/health/ready</code> · API docs (dev): <code>/api/docs</code>
      </p>
    </main>
  );
}

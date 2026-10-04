export const metadata = { title: 'Privacy Policy' };

export default function Privacy() {
  return (
    <main className="wrap narrow" style={{ maxWidth: 760 }}>
      <h1>Privacy Policy</h1>
      <p className="lead">How the Vendor Onboarding Platform handles personal data.</p>

      <section className="card">
        <h2>Scope</h2>
        <p>
          This platform is an internal system used to onboard and manage vendors. It processes
          personal data of vendor contacts and of the employees who operate the system. It is
          governed by the Digital Personal Data Protection Act, 2023 and the organisation&apos;s
          information security policies.
        </p>
      </section>

      <section className="card">
        <h2>What we process</h2>
        <ul>
          <li>Vendor identifiers such as PAN, GSTIN and bank account details.</li>
          <li>
            Vendor contact details, business and statutory information, and uploaded documents.
          </li>
          <li>User account data for operators: name, work email, role and access history.</li>
          <li>System and audit logs recording actions taken in the platform.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Purpose and lawful basis</h2>
        <p>
          Data is processed to assess vendor risk, perform due diligence, and maintain an auditable
          onboarding record. Processing is based on legitimate business and compliance obligations,
          including statutory verification and record-keeping requirements.
        </p>
      </section>

      <section className="card">
        <h2>Security</h2>
        <ul>
          <li>
            Sensitive fields such as PAN and bank account are encrypted at the field level;
            searchable values use a keyed blind index rather than plaintext.
          </li>
          <li>
            Access is role-based and denied by default; every sensitive action is recorded in an
            append-only audit trail.
          </li>
          <li>Documents are scanned for malware and stored under opaque keys.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Retention and residency</h2>
        <p>
          Records are retained for the period required by applicable law and internal policy, and
          are hosted in the designated data region. Data is deleted or anonymised once the retention
          period ends and no legal hold applies.
        </p>
      </section>

      <section className="card">
        <h2>Your rights and contact</h2>
        <p>
          Vendor representatives may request access to, or correction of, their information, subject
          to verification and legal limits. Requests are directed to the organisation&apos;s data
          protection contact through the procurement team that initiated the onboarding.
        </p>
      </section>

      <p className="faint" style={{ fontSize: '0.82rem' }}>
        This policy may be updated to reflect changes in law or process. Material changes are
        communicated to operators through the platform.
      </p>
    </main>
  );
}

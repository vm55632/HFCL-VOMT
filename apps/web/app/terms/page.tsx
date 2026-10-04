export const metadata = { title: 'Terms of Service' };

export default function Terms() {
  return (
    <main className="wrap narrow" style={{ maxWidth: 760 }}>
      <h1>Terms of Service</h1>
      <p className="lead">Conditions for using the Vendor Onboarding Platform.</p>

      <section className="card">
        <h2>Authorised use</h2>
        <p>
          Access is granted to authorised employees for the sole purpose of onboarding and managing
          vendors. You may use only the access assigned to your role and must not attempt to reach
          records or functions outside that access.
        </p>
      </section>

      <section className="card">
        <h2>Accounts and credentials</h2>
        <ul>
          <li>Keep your sign-in credentials confidential and do not share your account.</li>
          <li>Report suspected account compromise to the platform administrators without delay.</li>
          <li>Access is revoked on role change, deactivation, or end of engagement.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Confidentiality</h2>
        <p>
          Vendor and financial information in this platform is confidential. You may not copy,
          export, or disclose it except as required to perform your duties and permitted by policy.
        </p>
      </section>

      <section className="card">
        <h2>Monitoring and audit</h2>
        <p>
          Activity in the platform is logged and auditable. Use of the system constitutes consent to
          this monitoring for security, compliance and investigation purposes.
        </p>
      </section>

      <section className="card">
        <h2>Acceptable conduct</h2>
        <ul>
          <li>Enter accurate information and do not falsify vendor records or evidence.</li>
          <li>Do not circumvent approval steps, segregation of duties, or security controls.</li>
          <li>Do not upload malicious files or content unrelated to a legitimate onboarding.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Availability</h2>
        <p>
          The platform is provided for internal business use and may be subject to maintenance,
          change, or withdrawal. It is offered without warranty of uninterrupted availability.
        </p>
      </section>

      <p className="faint" style={{ fontSize: '0.82rem' }}>
        These terms may be updated. Continued use after an update constitutes acceptance of the
        revised terms.
      </p>
    </main>
  );
}

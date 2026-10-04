import Link from 'next/link';

export default function Pending() {
  return (
    <main className="wrap narrow">
      <h1>Access pending approval</h1>
      <p className="lead">
        Your account has been created and your access request has been sent to your manager for
        approval. You’ll be able to sign in once it’s approved.
      </p>
      <p className="note">
        This follows the platform’s Segregation-of-Duties policy: access is granted only after an
        authorised approval, never automatically.
      </p>
      <Link className="btn" href="/sign-in">
        Back to sign in
      </Link>
    </main>
  );
}

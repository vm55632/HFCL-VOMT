'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Global footer with legal links. Hidden on the full-screen auth page.
export default function Footer() {
  const pathname = usePathname() ?? '';
  if (pathname.startsWith('/sign-in')) return null;

  return (
    <footer className="footer">
      <span>Vendor Onboarding Platform</span>
      <span className="footer__spacer" />
      <Link href="/privacy">Privacy Policy</Link>
      <Link href="/terms">Terms of Service</Link>
    </footer>
  );
}

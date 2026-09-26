import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VOP — Vendor Onboarding Platform',
  description: 'Enterprise Vendor Onboarding Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

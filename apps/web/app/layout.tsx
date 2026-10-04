import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '../components/Sidebar';
import TopHeader from '../components/TopHeader';
import Footer from '../components/Footer';

export const metadata: Metadata = {
  title: 'VOP · Vendor Onboarding Platform',
  description: 'Enterprise Vendor Onboarding Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidebar />
          <div className="shell__main">
            <TopHeader />
            {children}
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}

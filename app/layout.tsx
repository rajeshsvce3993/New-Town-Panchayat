import type { Metadata, Viewport } from 'next';
import './globals.css';
import SecurityShield from '@/components/SecurityShield';
import { UI_SCALE_BOOTSTRAP } from '@/lib/uiScale';

export const metadata: Metadata = {
  title: 'Town Panchayat Management Portal',
  description: 'Comprehensive administrative, inspection, and employee provident fund management system for Tamil Nadu Town Panchayats.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ta" suppressHydrationWarning>
      <body className="antialiased min-h-screen text-slate-900" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: UI_SCALE_BOOTSTRAP }} />
        <SecurityShield />
        {children}
      </body>
    </html>
  );
}

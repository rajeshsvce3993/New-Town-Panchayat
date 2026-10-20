import type { Metadata } from 'next';
import './globals.css';
import SecurityShield from '@/components/SecurityShield';

export const metadata: Metadata = {
  title: 'Town Panchayat Management Portal',
  description: 'Comprehensive administrative, inspection, and employee provident fund management system for Tamil Nadu Town Panchayats.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ta" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900" suppressHydrationWarning>
        <SecurityShield />
        {children}
      </body>
    </html>
  );
}

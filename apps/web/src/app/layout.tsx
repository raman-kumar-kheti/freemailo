import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MailHive - Production Webmail',
  description: 'Self-hosted, Gmail-inspired multi-domain email hosting platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        {children}
      </body>
    </html>
  );
}

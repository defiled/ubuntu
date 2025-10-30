import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cross-Border Payment Terminal',
  description: 'Bank of the Future - Secure • Instant • Global',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="crt-effect">
        {children}
      </body>
    </html>
  );
}

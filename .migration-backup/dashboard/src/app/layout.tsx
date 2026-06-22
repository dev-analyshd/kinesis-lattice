import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KINESIS — The Living Delegation Lattice',
  description: 'Self-organizing agent federation on Terminal 3 TEE infrastructure',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

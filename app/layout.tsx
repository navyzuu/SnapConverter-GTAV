import type { Metadata } from 'next';
import { Space_Mono, DM_Sans } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SnapConvert — GTA V Snapmatic to JPEG',
  description: 'Convert GTA V Snapmatic files to JPEG locally. No upload required.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${dmSans.variable}`}>
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}

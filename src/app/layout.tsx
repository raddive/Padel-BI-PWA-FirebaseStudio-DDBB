import type {Metadata, Viewport} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { PwaRegister } from '@/components/pwa-register';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Padel BI',
  description: 'Contador y estadísticas de partidos de pádel.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'Padel BI',
  },
};

export const viewport: Viewport = {
  themeColor: '#f59e0b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}

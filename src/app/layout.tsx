import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Taller de Cerámica — Norma',
  description:
    'Piezas únicas de cerámica artesanal modeladas y horneadas a mano en el taller de Norma.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZAV | Gestión de productos terminados',
  description: 'Sistema web administrativo de ZAV para inventario y trazabilidad de productos terminados.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}

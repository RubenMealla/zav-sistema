import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZAV | Gestión de productos terminados',
  description: 'Sistema web de ZAV para el registro y la consulta de productos y lotes.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}

import type { ReactNode } from 'react';

export type NombreIcono =
  | 'inicio' | 'producto' | 'lote' | 'condicion' | 'movimiento' | 'mas' | 'flecha'
  | 'escudo' | 'ubicacion' | 'historial' | 'menu' | 'cerrar' | 'usuario' | 'check'
  | 'alerta' | 'ojo' | 'ojoCerrado';

const trazos: Record<NombreIcono, ReactNode> = {
  inicio:<><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-7h5v7"/></>,
  producto:<><path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z"/><path d="M4 7.5V17l8 4 8-4V7.5"/><path d="M12 12v9"/></>,
  lote:<><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  condicion:<><path d="M12 3 4.5 6v5.5c0 4.6 3.2 7.8 7.5 9.5 4.3-1.7 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
  movimiento:<><path d="M5 7h12"/><path d="m14 4 3 3-3 3"/><path d="M19 17H7"/><path d="m10 14-3 3 3 3"/></>,
  mas:<><path d="M12 5v14M5 12h14"/></>,
  flecha:<><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
  escudo:<><path d="M12 3 5 6v5c0 4.4 2.8 7.6 7 10 4.2-2.4 7-5.6 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
  ubicacion:<><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  historial:<><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M12 7v5l3 2"/></>,
  menu:<><path d="M4 7h16M4 12h16M4 17h16"/></>,
  cerrar:<><path d="m6 6 12 12M18 6 6 18"/></>,
  usuario:<><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
  check:<path d="m5 12 4 4L19 6"/>,
  alerta:<><path d="M12 4 3.5 20h17L12 4Z"/><path d="M12 9v5M12 17h.01"/></>,
  ojo:<><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
  ojoCerrado:<><path d="m3 3 18 18"/><path d="M10.6 6.2A10.9 10.9 0 0 1 12 6c6 0 9.5 6 9.5 6a15.3 15.3 0 0 1-3 3.6M6.1 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9.4 9.4 0 0 0 3-.5"/><path d="M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6"/></>,
};

export function Icono({ nombre, tamano = 18 }: { nombre: NombreIcono; tamano?: number }) {
  return <svg aria-hidden="true" className="icono" width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{trazos[nombre]}</svg>;
}

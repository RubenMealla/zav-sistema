"use client";
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useActualizacionVisible } from './lib/use-actualizacion-visible';

export function ActualizacionPanel() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const actualizar = () => iniciar(() => router.refresh());
  useActualizacionVisible(actualizar, pendiente);
  return <button type="button" className="boton boton-secundario" disabled={pendiente} onClick={actualizar} aria-label="Actualizar datos del panel">{pendiente ? 'Actualizando…' : 'Actualizar'}</button>;
}

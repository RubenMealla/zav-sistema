'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Icono } from './icono';

export function BotonEnviar({ children, pendiente = 'Guardando…', className = 'boton boton-primario', disabled = false }: { children: ReactNode; pendiente?: string; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={disabled || pending} aria-busy={pending}>{pending ? pendiente : children}</button>;
}

export function Modal({
  boton,
  titulo,
  descripcion,
  children,
  variante = 'principal',
}: {
  boton: string;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  variante?: 'principal' | 'secundaria';
}) {
  const referencia = useRef<HTMLDialogElement>(null);
  const id = useId();

  function cerrar() {
    referencia.current?.close();
  }

  return (
    <>
      <button
        type="button"
        className={variante === 'principal' ? 'boton boton-primario' : 'boton boton-secundario'}
        onClick={() => referencia.current?.showModal()}
      >
        <Icono nombre="mas" tamano={17} />
        {boton}
      </button>
      <dialog
        ref={referencia}
        className="modal"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={descripcion ? `${id}-descripcion` : undefined}
        onKeyDown={(evento) => {
          if (evento.key !== 'Tab') return;
          const controles = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>(
            'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]',
          )).filter((control) => control.tabIndex >= 0 && !control.matches(':disabled') && control.getClientRects().length > 0);
          const primero = controles[0];
          const ultimo = controles.at(-1);
          if (evento.shiftKey && document.activeElement === primero) {
            evento.preventDefault();
            ultimo?.focus();
          } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primero?.focus();
          }
        }}
        onClick={(evento) => {
          if (evento.target === referencia.current) cerrar();
        }}
      >
        <div className="modal-caja">
          <header className="modal-cabecera">
            <div>
              <span className="eyebrow">OPERACIÓN</span>
              <h2 id={`${id}-titulo`}>{titulo}</h2>
              {descripcion && <p id={`${id}-descripcion`}>{descripcion}</p>}
            </div>
            <button type="button" className="boton-icono" aria-label="Cerrar ventana" onClick={cerrar}>
              <Icono nombre="cerrar" />
            </button>
          </header>
          <div className="modal-contenido">{children}</div>
        </div>
      </dialog>
    </>
  );
}

export function Notificacion({
  tipo,
  mensaje,
}: {
  tipo: 'exito' | 'error';
  mensaje: string;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const temporizador = window.setTimeout(
      () => setVisible(false),
      tipo === 'error' ? 6000 : 4200,
    );
    return () => window.clearTimeout(temporizador);
  }, [tipo, mensaje]);

  if (!visible) return null;

  return (
    <div className={`toast toast-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <span className="toast-icono">
        <Icono nombre={tipo === 'error' ? 'alerta' : 'check'} tamano={18} />
      </span>
      <div>
        <strong>{tipo === 'error' ? 'No se pudo completar' : 'Operación completada'}</strong>
        <p>{mensaje}</p>
      </div>
      <button type="button" className="boton-icono toast-cerrar" aria-label="Cerrar notificación" onClick={() => setVisible(false)}>
        <Icono nombre="cerrar" tamano={16} />
      </button>
    </div>
  );
}

export function CampoContrasena() {
  const [visible, setVisible] = useState(false);
  return (
    <div className="campo">
      <label htmlFor="contrasena">Contraseña</label>
      <div className="campo-con-accion campo-con-icono">
        <input id="contrasena" type={visible ? 'text' : 'password'} name="contrasena" autoComplete="current-password" required placeholder="Ingresa tu contraseña" />
        <button type="button" aria-controls="contrasena" aria-pressed={visible} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVisible((valor) => !valor)}>
          <Icono nombre={visible ? 'ojoCerrado' : 'ojo'} tamano={19} />
        </button>
      </div>
    </div>
  );
}

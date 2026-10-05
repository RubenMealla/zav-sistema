'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal, useFormStatus } from 'react-dom';
import { Icono, type NombreIcono } from './icono';

type ConfirmacionEnvio = {
  titulo: string;
  mensaje: string;
  confirmar?: string;
  variante?: 'normal' | 'peligro';
};

export function BotonEnviar({
  children,
  pendiente = 'Guardando…',
  className = 'boton boton-primario',
  disabled = false,
  confirmacion,
}: {
  children: ReactNode;
  pendiente?: string;
  className?: string;
  disabled?: boolean;
  confirmacion?: ConfirmacionEnvio;
}) {
  const { pending } = useFormStatus();
  const [confirmando, setConfirmando] = useState(false);
  const id = useId();
  const formularioRef = useRef<HTMLFormElement | null>(null);
  const disparadorRef = useRef<HTMLButtonElement | null>(null);

  function cerrarConfirmacion() {
    setConfirmando(false);
    window.requestAnimationFrame(() => disparadorRef.current?.focus());
  }

  if (!confirmacion) {
    return <button type="submit" className={className} disabled={disabled || pending} aria-busy={pending}>{pending ? pendiente : children}</button>;
  }

  return (
    <>
      <button
        ref={disparadorRef}
        type="button"
        className={className}
        disabled={disabled || pending}
        aria-haspopup="dialog"
        onClick={(evento) => {
          const formulario = evento.currentTarget.form;
          if (formulario && !formulario.reportValidity()) return;
          formularioRef.current = formulario;
          setConfirmando(true);
        }}
      >
        {children}
      </button>
      {confirmando && typeof document !== 'undefined' && createPortal(
        <div
          className="confirmacion-capa"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget && !pending) cerrarConfirmacion();
          }}
          onKeyDown={(evento) => {
            if (evento.key === 'Escape' && !pending) cerrarConfirmacion();
          }}
        >
          <section
            className={`confirmacion-caja ${confirmacion.variante === 'peligro' ? 'confirmacion-peligro' : ''}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${id}-confirmacion-titulo`}
            aria-describedby={`${id}-confirmacion-mensaje`}
          >
            <span className="confirmacion-icono" aria-hidden="true">
              <Icono nombre={confirmacion.variante === 'peligro' ? 'alerta' : 'check'} tamano={22} />
            </span>
            <div className="confirmacion-texto">
              <span className="confirmacion-etiqueta">{confirmacion.variante === 'peligro' ? 'ACCIÓN SENSIBLE' : 'CONFIRMAR OPERACIÓN'}</span>
              <h2 id={`${id}-confirmacion-titulo`}>{confirmacion.titulo}</h2>
              <p id={`${id}-confirmacion-mensaje`}>{confirmacion.mensaje}</p>
            </div>
            <div className="confirmacion-acciones">
              <button type="button" className="boton boton-terciario" disabled={pending} autoFocus onClick={cerrarConfirmacion}>Cancelar</button>
              <button
                type="button"
                className={confirmacion.variante === 'peligro' ? 'boton boton-primario boton-peligro' : 'boton boton-primario'}
                disabled={pending}
                aria-busy={pending}
                onClick={() => formularioRef.current?.requestSubmit()}
              >
                {pending ? pendiente : (confirmacion.confirmar ?? 'Confirmar')}
              </button>
            </div>
          </section>
        </div>,
        disparadorRef.current?.closest('dialog') ?? document.body,
      )}
    </>
  );
}

export function Modal({
  boton,
  titulo,
  descripcion,
  children,
  variante = 'principal',
  icono,
  etiqueta = 'OPERACIÓN',
  amplio = false,
}: {
  boton: string;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  variante?: 'principal' | 'secundaria' | 'terciaria';
  icono?: NombreIcono | null;
  etiqueta?: string;
  amplio?: boolean;
}) {
  const referencia = useRef<HTMLDialogElement>(null);
  const id = useId();
  const disparador = useRef<HTMLButtonElement>(null);
  const iconoVisible = icono === undefined ? (variante === 'principal' ? 'mas' : null) : icono;
  const claseBoton = variante === 'principal'
    ? 'boton boton-primario'
    : variante === 'secundaria'
      ? 'boton boton-secundario'
      : 'boton boton-terciario boton-detalle';

  function cerrar() {
    referencia.current?.close();
    disparador.current?.focus();
  }

  return (
    <>
      <button
        ref={disparador}
        type="button"
        className={claseBoton}
        onClick={() => referencia.current?.showModal()}
      >
        {iconoVisible && <Icono nombre={iconoVisible} tamano={16} />}
        {boton}
      </button>
      <dialog
        ref={referencia}
        className={amplio ? 'modal modal-amplio' : 'modal'}
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
        onClose={() => disparador.current?.focus()}
        onClick={(evento) => {
          if (evento.target === referencia.current) cerrar();
        }}
      >
        <div className="modal-caja">
          <header className="modal-cabecera">
            <div>
              <span className="eyebrow">{etiqueta}</span>
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

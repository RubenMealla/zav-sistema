'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icono } from './icono';

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
        onClick={(evento) => {
          if (evento.target === referencia.current) cerrar();
        }}
      >
        <div className="modal-caja">
          <header className="modal-cabecera">
            <div>
              <span className="eyebrow">OPERACIÓN</span>
              <h2>{titulo}</h2>
              {descripcion && <p>{descripcion}</p>}
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
    const temporizador = window.setTimeout(() => setVisible(false), 5200);
    return () => window.clearTimeout(temporizador);
  }, []);

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
      <div className="campo-con-accion">
        <input
          id="contrasena"
          type={visible ? 'text' : 'password'}
          name="contrasena"
          autoComplete="current-password"
          required
          placeholder="Ingresa tu contraseña"
        />
        <button type="button" onClick={() => setVisible((valor) => !valor)}>
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    </div>
  );
}

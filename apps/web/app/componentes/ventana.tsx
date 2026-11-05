"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icono } from "./icono";

/** Ventana controlada con la misma presentación que los modales del panel. */
export function Ventana({
  titulo,
  etiqueta = "ZAV",
  children,
  cerrar,
  amplia = false,
}: {
  titulo: string;
  etiqueta?: string;
  children: ReactNode;
  cerrar: () => void;
  amplia?: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const origen =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const elemento = dialogo.current;
    elemento?.showModal();
    return () => {
      elemento?.close();
      if (origen?.isConnected) origen.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogo}
      className={amplia ? "modal modal-amplio" : "modal"}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        cerrar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      <div className="modal-caja">
        <header className="modal-cabecera">
          <div>
            <span className="eyebrow">{etiqueta}</span>
            <h2 id={id}>{titulo}</h2>
          </div>
          <button
            type="button"
            className="boton-icono"
            aria-label="Cerrar ventana"
            onClick={cerrar}
          >
            <Icono nombre="cerrar" />
          </button>
        </header>
        <div className="modal-contenido">{children}</div>
      </div>
    </dialog>
  );
}

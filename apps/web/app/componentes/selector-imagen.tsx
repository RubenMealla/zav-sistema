"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Icono } from "./icono";

type Props = {
  imagenId: string | null;
  imagenInicialId: string | null;
  imagenOriginal?: string | null;
  subir: (archivo: File) => Promise<string>;
  cambiar: (id: string | null) => void;
  alCargar: (cargando: boolean) => void;
  alError: (mensaje: string) => void;
};

export function SelectorImagen({ imagenId, imagenInicialId, imagenOriginal, subir, cambiar, alCargar, alError }: Props) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const solicitud = useRef(0);
  const ocupada = useRef(false);
  const [cargando, setCargando] = useState(false);
  const [vistaLocal, setVistaLocal] = useState<string | null>(null);
  const [archivoActual, setArchivoActual] = useState("");

  useEffect(() => () => { solicitud.current++; }, []);
  useEffect(() => () => { if (vistaLocal) URL.revokeObjectURL(vistaLocal); }, [vistaLocal]);

  async function seleccionar(archivo?: File) {
    if (!archivo || ocupada.current) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type) || archivo.size === 0 || archivo.size > 5 * 1024 * 1024) {
      alError("Selecciona una fotografía PNG, JPEG o WebP de hasta 5 MB que no esté vacía.");
      return;
    }
    const numero = ++solicitud.current;
    ocupada.current = true;
    setCargando(true);
    alCargar(true);
    alError("");
    setVistaLocal(URL.createObjectURL(archivo));
    try {
      const nuevaId = await subir(archivo);
      if (numero !== solicitud.current) return;
      cambiar(nuevaId);
      setArchivoActual(`${archivo.name} · ${(archivo.size / 1024).toLocaleString("es-BO", { maximumFractionDigits: 0 })} KB`);
    } catch (error) {
      if (numero === solicitud.current) alError(error instanceof Error ? error.message : "No se pudo subir la fotografía.");
    } finally {
      if (numero === solicitud.current) {
        ocupada.current = false;
        setVistaLocal(null);
        setCargando(false);
        alCargar(false);
      }
    }
  }

  const src = vistaLocal ?? (imagenId ? `/api/gestion/catalogo/imagenes/${imagenId}` : imagenOriginal);
  return (
    <fieldset className="selector-imagen gestion-ancho" aria-busy={cargando}>
      <legend>Fotografía</legend>
      <div className="selector-imagen-contenido">
        <div className="selector-imagen-vista">
          {src ? (
            <Image src={src} alt="Vista previa de la fotografía" width={240} height={180} sizes="240px" unoptimized={!!imagenId || !!vistaLocal} />
          ) : (
            <span className="selector-imagen-vacia"><Icono nombre="producto" tamano={36} />Sin fotografía</span>
          )}
          {cargando && <span className="selector-imagen-progreso">Subiendo…</span>}
        </div>
        <div className="selector-imagen-controles">
          <p id={`${id}-ayuda`}>PNG, JPEG o WebP · Hasta 5 MB</p>
          <input
            ref={entrada}
            className="selector-imagen-entrada"
            type="file"
            aria-label="Fotografía"
            aria-describedby={`${id}-ayuda`}
            accept="image/png,image/jpeg,image/webp"
            disabled={cargando}
            tabIndex={-1}
            onChange={evento => {
              const archivo = evento.currentTarget.files?.[0];
              evento.currentTarget.value = "";
              void seleccionar(archivo);
            }}
          />
          <button type="button" className="boton boton-secundario" disabled={cargando} onClick={() => entrada.current?.click()}>
            {src ? "Cambiar fotografía" : "Seleccionar fotografía"}
          </button>
          {imagenId !== imagenInicialId && (
            <button type="button" className="boton boton-terciario" disabled={cargando} onClick={() => { cambiar(imagenInicialId); setArchivoActual(""); alError(""); }}>
              Deshacer cambio de foto
            </button>
          )}
          <p className="selector-imagen-estado" role="status">
            {cargando ? "Validando fotografía…" : archivoActual ? "Fotografía lista. Guarda los cambios para aplicarla." : src ? "Fotografía actual" : "Sin archivo seleccionado"}
          </p>
          {archivoActual && <small className="selector-imagen-nombre" title={archivoActual}>{archivoActual}</small>}
        </div>
      </div>
    </fieldset>
  );
}

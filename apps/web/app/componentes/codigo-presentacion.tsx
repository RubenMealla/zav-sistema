"use client";
import { useEffect, useState } from 'react';
import { PATRON_CODIGO_SKU } from './validacion-formularios';

export function CodigoPresentacion({ familiaId, existente }: { familiaId: string; existente?: string }) {
  const [manual, setManual] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [sugerencia, setSugerencia] = useState({ familiaId: '', revision: -1, codigo: '', error: '' });
  const vigente = sugerencia.familiaId === familiaId && sugerencia.revision === revision;
  const cargando = !existente && manual === null && !!familiaId && !vigente;
  const valor = existente ?? manual ?? (vigente ? sugerencia.codigo : '');
  useEffect(() => {
    if (existente || manual !== null || !familiaId) return;
    const abortar = new AbortController();
    async function sugerir() {
      try {
        const r = await fetch(`/api/codigos/producto?familiaId=${encodeURIComponent(familiaId)}`, { cache: 'no-store', signal: abortar.signal });
        const datos = await r.json() as { codigo?: string; message?: string };
        if (!r.ok || !datos.codigo) throw new Error(datos.message ?? 'No se pudo sugerir el código.');
        if (!abortar.signal.aborted) setSugerencia({ familiaId, revision, codigo: datos.codigo, error: '' });
      } catch (e) {
        if (!abortar.signal.aborted) setSugerencia({ familiaId, revision, codigo: '', error: e instanceof Error ? e.message : 'No se pudo sugerir el código.' });
      }
    }
    void sugerir();
    return () => abortar.abort();
  }, [familiaId, existente, manual, revision]);
  return <div className="campo">
    <label htmlFor="catalogo-codigo-sku">Código SKU</label>
    <div className="campo-control-compuesto">
      <input id="catalogo-codigo-sku" name="codigo" value={valor} required readOnly={!!existente} minLength={2} maxLength={40} pattern={PATRON_CODIGO_SKU}
        placeholder={cargando ? 'Generando…' : 'Selecciona una familia'}
        data-validacion="Usa de 2 a 40 letras, números, puntos, guiones o guiones bajos. Empieza con una letra o un número."
        onChange={e => setManual(e.target.value.toUpperCase())} onBlur={e => { if (manual !== null) setManual(e.target.value.trim()); }} />
      {!existente && <button type="button" className="boton boton-secundario" disabled={!familiaId || cargando} onClick={() => { setManual(null); setRevision(r => r + 1); }}>Sugerir</button>}
    </div>
    <small>{existente ? 'Único y permanente.' : 'Se completa al elegir la familia. Puedes usar tu propio código.'}</small>
    {vigente && sugerencia.error && manual === null && <small role="status">{sugerencia.error} Puedes reintentar con Sugerir.</small>}
  </div>;
}

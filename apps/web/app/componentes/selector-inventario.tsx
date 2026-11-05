"use client";
import { useEffect, useId, useState } from 'react';
type Opcion = { id: string; codigo: string; nombre?: string; presentacion?: string; condicion?: string };

/** La búsqueda consulta toda la base, no sólo la primera página del panel. */
export function SelectorInventario({ tipo, iniciales, id, name, value, onChange, etiqueta, required = true }: {
  tipo: 'productos' | 'lotes'; iniciales: Opcion[]; id: string; name: string;
  value?: string; etiqueta?: string; onChange?: (id: string) => void; required?: boolean;
}) {
  const busquedaId = useId();
  const [q, setQ] = useState('');
  const [seleccion, setSeleccion] = useState(value ?? '');
  const [elegida, setElegida] = useState<Opcion | undefined>();
  const [resultado, setResultado] = useState({ q: '', items: iniciales, total: iniciales.length, error: '' });
  const buscando = !!q.trim() && resultado.q !== q.trim();
  const opciones = q.trim() && !buscando ? resultado.items : iniciales;
  const valor = onChange ? (value ?? '') : seleccion;
  const visibles = elegida && !opciones.some(p => p.id === elegida.id) ? [elegida, ...opciones] : opciones;
  useEffect(() => {
    const consulta = q.trim();
    if (!consulta) return;
    const abortar = new AbortController();
    const t = setTimeout(async () => {
      try {
        const parametros = new URLSearchParams({ q: consulta, limit: '50', ...(tipo === 'productos' ? { activo: 'true' } : {}) });
        const r = await fetch(`/api/gestion/${tipo}?${parametros}`, { cache: 'no-store', signal: abortar.signal });
        if (!r.ok) throw new Error('No se pudo buscar. Inténtalo nuevamente.');
        const datos = await r.json() as { items: Opcion[]; total: number };
        if (!abortar.signal.aborted) setResultado({ q: consulta, ...datos, error: '' });
      } catch (e) {
        if (!abortar.signal.aborted) setResultado({ q: consulta, items: [], total: 0, error: e instanceof Error ? e.message : 'No se pudo buscar.' });
      }
    }, 250);
    return () => { clearTimeout(t); abortar.abort(); };
  }, [q, tipo]);
  return <div className="campo selector-inventario">
    <input id={busquedaId} aria-label={tipo === 'productos' ? 'Buscar presentación en todo el catálogo' : 'Buscar lote o producto en todo el inventario'} type="search" placeholder="Buscar por nombre o código" maxLength={100} value={q} onChange={e => setQ(e.target.value)} />
    <select id={id} aria-label={etiqueta} name={name} required={required} value={valor} onChange={e => { const nuevo = e.target.value; setSeleccion(nuevo); setElegida(visibles.find(p => p.id === nuevo)); onChange?.(nuevo); }}>
      <option value="">{tipo === 'productos' ? 'Selecciona un producto' : 'Selecciona un lote'}</option>
      {visibles.map(p => <option key={p.id} value={p.id}>{[p.codigo, p.nombre, p.presentacion, p.condicion].filter(Boolean).join(' · ')}</option>)}
    </select>
    {buscando ? <small role="status">Buscando…</small> : q.trim() && (resultado.error || resultado.total === 0 || resultado.total > 50) ? <small role="status">{resultado.error || (resultado.total > 50 ? 'Se muestran 50 coincidencias. Escribe más para afinar la búsqueda.' : 'No hay coincidencias.')}</small> : null}
  </div>;
}

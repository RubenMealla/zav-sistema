'use client';

import { useEffect, useRef, useState } from 'react';
import { BotonEnviar } from './interacciones';
import { Icono } from './icono';

type Punto = { latitud: number; longitud: number };
type ResultadoDireccion = Punto & { direccion: string; principal: string; secundaria: string; tipo: string };
type RespuestaDirecciones = { resultados?: ResultadoDireccion[] };
type LeafletLatLng = { lat: number; lng: number };
type LeafletMarker = {
  setLatLng(latlng: [number, number]): LeafletMarker;
  addTo(map: LeafletMap): LeafletMarker;
  bindPopup(texto: string): LeafletMarker;
  openPopup(): LeafletMarker;
};
type LeafletMap = {
  setView(latlng: [number, number], zoom: number): LeafletMap;
  on(evento: 'click', callback: (evento: { latlng: LeafletLatLng }) => void): LeafletMap;
  remove(): void;
  invalidateSize(): void;
};
type LeafletApi = {
  map(elemento: HTMLElement, opciones?: Record<string, unknown>): LeafletMap;
  marker(latlng: [number, number]): LeafletMarker;
  tileLayer(url: string, opciones: { maxZoom: number; attribution: string }): { addTo(map: LeafletMap): void };
};

declare global {
  interface Window { L?: LeafletApi; __zavLeafletPromise?: Promise<LeafletApi>; }
}

const CENTRO_TARIJA: Punto = { latitud: -21.535486, longitud: -64.729557 };
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function cargarLeaflet(): Promise<LeafletApi> {
  if (window.L) return Promise.resolve(window.L);
  if (window.__zavLeafletPromise) return window.__zavLeafletPromise;
  window.__zavLeafletPromise = new Promise<LeafletApi>((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const enlace = document.createElement('link');
      enlace.rel = 'stylesheet'; enlace.href = LEAFLET_CSS;
      enlace.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      enlace.crossOrigin = ''; document.head.appendChild(enlace);
    }
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
    if (existente) {
      existente.addEventListener('load', () => window.L ? resolve(window.L) : reject(new Error('Leaflet no disponible.')), { once: true });
      existente.addEventListener('error', () => reject(new Error('No se pudo cargar Leaflet.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = ''; script.async = true;
    script.addEventListener('load', () => window.L ? resolve(window.L) : reject(new Error('Leaflet no disponible.')), { once: true });
    script.addEventListener('error', () => reject(new Error('No se pudo cargar Leaflet.')), { once: true });
    document.head.appendChild(script);
  });
  return window.__zavLeafletPromise;
}

export function MapaUbicacion({ latitud, longitud }: { latitud: number | null; longitud: number | null }) {
  const latitudInicial = latitud !== null && Number.isFinite(latitud) ? latitud : null;
  const longitudInicial = longitud !== null && Number.isFinite(longitud) ? longitud : null;
  const inicial = latitudInicial !== null && longitudInicial !== null ? { latitud: latitudInicial, longitud: longitudInicial } : null;
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletApi | null>(null);
  const marcadorRef = useRef<LeafletMarker | null>(null);
  const [punto, setPunto] = useState<Punto | null>(inicial);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<ResultadoDireccion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');

  function colocarMarcador(siguiente: Punto, texto: string, zoom = 17) {
    setPunto(siguiente);
    mapaRef.current?.setView([siguiente.latitud, siguiente.longitud], zoom);
    if (marcadorRef.current) {
      marcadorRef.current.setLatLng([siguiente.latitud, siguiente.longitud]).bindPopup(texto).openPopup();
    } else if (leafletRef.current && mapaRef.current) {
      marcadorRef.current = leafletRef.current.marker([siguiente.latitud, siguiente.longitud]).addTo(mapaRef.current).bindPopup(texto).openPopup();
    }
  }

  useEffect(() => {
    let activo = true;
    void cargarLeaflet().then((L) => {
      if (!activo || !contenedorRef.current) return;
      leafletRef.current = L;
      const tieneInicial = latitudInicial !== null && longitudInicial !== null;
      const centro = tieneInicial ? { latitud: latitudInicial, longitud: longitudInicial } : CENTRO_TARIJA;
      const mapa = L.map(contenedorRef.current, { zoomControl: true, attributionControl: true }).setView([centro.latitud, centro.longitud], tieneInicial ? 17 : 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      }).addTo(mapa);
      mapaRef.current = mapa;
      if (tieneInicial) marcadorRef.current = L.marker([latitudInicial, longitudInicial]).addTo(mapa).bindPopup('Ubicación guardada de Venta y Despacho');
      mapa.on('click', ({ latlng }) => colocarMarcador({ latitud: latlng.lat, longitud: latlng.lng }, 'Punto seleccionado'));
      setEstado('listo');
      window.setTimeout(() => mapa.invalidateSize(), 0);
    }).catch(() => activo && setEstado('error'));
    return () => { activo = false; mapaRef.current?.remove(); mapaRef.current = null; leafletRef.current = null; };
  }, [latitudInicial, longitudInicial]);

  useEffect(() => {
    const q = consulta.trim();
    if (q.length < 2) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(async () => {
      setBuscando(true); setErrorBusqueda('');
      try {
        const respuesta = await fetch(`/api/geografia/autocompletar?q=${encodeURIComponent(q)}`, { cache: 'no-store', signal: controlador.signal });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const cuerpo = await respuesta.json() as RespuestaDirecciones;
        setResultados(Array.isArray(cuerpo.resultados) ? cuerpo.resultados : []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setResultados([]);
          setErrorBusqueda('No se pudieron consultar direcciones. Puedes seleccionar el punto directamente en el mapa.');
        }
      } finally {
        if (!controlador.signal.aborted) setBuscando(false);
      }
    }, 280);
    return () => { window.clearTimeout(temporizador); controlador.abort(); };
  }, [consulta]);

  function seleccionarResultado(resultado: ResultadoDireccion) {
    setConsulta(resultado.direccion); setResultados([]); setErrorBusqueda('');
    colocarMarcador({ latitud: resultado.latitud, longitud: resultado.longitud }, resultado.principal || 'Punto seleccionado');
  }

  return (
    <div className="ubicacion-editor">
      <div className="ubicacion-buscador">
        <label htmlFor="buscar-direccion-tarija">Buscar dirección en Tarija</label>
        <div className="ubicacion-buscador-campo">
          <Icono nombre="ubicacion" tamano={18} />
          <input id="buscar-direccion-tarija" type="search" role="combobox" value={consulta} onChange={(e) => {
            const valor = e.target.value;
            setConsulta(valor);
            if (valor.trim().length < 2) {
              setResultados([]);
              setBuscando(false);
              setErrorBusqueda('');
            }
          }} placeholder="Barrio, calle, localidad o referencia" autoComplete="off" aria-autocomplete="list" aria-expanded={resultados.length > 0} aria-controls="sugerencias-direccion" />
          {buscando && <span className="ubicacion-buscando">Buscando…</span>}
        </div>
        {resultados.length > 0 && (
          <div id="sugerencias-direccion" className="ubicacion-sugerencias" role="listbox" aria-label="Direcciones sugeridas en Tarija">
            {resultados.map((r) => (
              <button type="button" role="option" aria-selected="false" key={`${r.latitud}:${r.longitud}:${r.direccion}`} onClick={() => seleccionarResultado(r)}>
                <strong>{r.principal || r.direccion}</strong><span>{r.secundaria || r.direccion}</span>
              </button>
            ))}
          </div>
        )}
        {errorBusqueda && <p className="ubicacion-busqueda-error" role="status">{errorBusqueda}</p>}
      </div>

      <div className="mapa-selector-wrap">
        <div ref={contenedorRef} className="mapa-selector" role="application" aria-label="Mapa para seleccionar la ubicación de Venta y Despacho" />
        {estado === 'cargando' && <div className="mapa-estado">Cargando mapa…</div>}
        {estado === 'error' && <div className="mapa-estado mapa-error">No se pudo cargar el mapa. Comprueba la conexión e inténtalo nuevamente.</div>}
      </div>

      <input type="hidden" name="latitud" value={punto?.latitud ?? ''} readOnly />
      <input type="hidden" name="longitud" value={punto?.longitud ?? ''} readOnly />

      <div className="ubicacion-editor-pie">
        <div>
          <strong>{punto ? 'Punto listo para guardar' : 'Selecciona el punto de despacho'}</strong>
          <span>{punto ? 'El marcador permanecerá guardado y visible cuando vuelvas al panel.' : 'Busca una dirección o haz clic/toca el mapa para colocar el marcador.'}</span>
        </div>
        <div className="ubicacion-editor-acciones">
          <button type="button" className="boton boton-secundario" onClick={() => mapaRef.current?.setView([CENTRO_TARIJA.latitud, CENTRO_TARIJA.longitud], 15)}>Centrar en Tarija</button>
          <BotonEnviar disabled={!punto}>{inicial ? 'Actualizar ubicación' : 'Guardar ubicación'}</BotonEnviar>
        </div>
      </div>
    </div>
  );
}

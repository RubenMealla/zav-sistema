'use client';

import { useEffect, useRef, useState } from 'react';
import { BotonEnviar } from './interacciones';

type Punto = { latitud: number; longitud: number };
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
  tileLayer(
    url: string,
    opciones: { maxZoom: number; attribution: string },
  ): { addTo(map: LeafletMap): void };
};

declare global {
  interface Window {
    L?: LeafletApi;
    __zavLeafletPromise?: Promise<LeafletApi>;
  }
}

const CENTRO_TARIJA: Punto = {
  latitud: -21.535486,
  longitud: -64.729557,
};

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function cargarLeaflet(): Promise<LeafletApi> {
  if (window.L) return Promise.resolve(window.L);
  if (window.__zavLeafletPromise) return window.__zavLeafletPromise;

  window.__zavLeafletPromise = new Promise<LeafletApi>((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const enlace = document.createElement('link');
      enlace.rel = 'stylesheet';
      enlace.href = LEAFLET_CSS;
      enlace.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      enlace.crossOrigin = '';
      document.head.appendChild(enlace);
    }

    const existente = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
    if (existente) {
      existente.addEventListener('load', () => {
        if (window.L) resolve(window.L);
        else reject(new Error('Leaflet no disponible.'));
      }, { once: true });
      existente.addEventListener('error', () => reject(new Error('No se pudo cargar Leaflet.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.async = true;
    script.addEventListener('load', () => {
      if (window.L) resolve(window.L);
      else reject(new Error('Leaflet no disponible.'));
    }, { once: true });
    script.addEventListener('error', () => reject(new Error('No se pudo cargar Leaflet.')), { once: true });
    document.head.appendChild(script);
  });

  return window.__zavLeafletPromise;
}

export function MapaUbicacion({
  latitud,
  longitud,
}: {
  latitud: number | null;
  longitud: number | null;
}) {
  const inicial =
    Number.isFinite(latitud) && Number.isFinite(longitud) && latitud !== null && longitud !== null
      ? { latitud, longitud }
      : null;

  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<LeafletMap | null>(null);
  const marcadorRef = useRef<LeafletMarker | null>(null);
  const [punto, setPunto] = useState<Punto | null>(inicial);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');

  useEffect(() => {
    let activo = true;

    void cargarLeaflet()
      .then((L) => {
        if (!activo || !contenedorRef.current) return;

        const centro = inicial ?? CENTRO_TARIJA;
        const mapa = L.map(contenedorRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([centro.latitud, centro.longitud], inicial ? 17 : 14);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(mapa);

        if (inicial) {
          marcadorRef.current = L.marker([inicial.latitud, inicial.longitud])
            .addTo(mapa)
            .bindPopup('Ubicación guardada de Venta y Despacho');
        }

        mapa.on('click', ({ latlng }) => {
          const siguiente = { latitud: latlng.lat, longitud: latlng.lng };
          setPunto(siguiente);

          if (marcadorRef.current) {
            marcadorRef.current
              .setLatLng([siguiente.latitud, siguiente.longitud])
              .bindPopup('Punto seleccionado')
              .openPopup();
          } else {
            marcadorRef.current = L.marker([siguiente.latitud, siguiente.longitud])
              .addTo(mapa)
              .bindPopup('Punto seleccionado')
              .openPopup();
          }
        });

        mapaRef.current = mapa;
        setEstado('listo');
        window.setTimeout(() => mapa.invalidateSize(), 0);
      })
      .catch(() => {
        if (activo) setEstado('error');
      });

    return () => {
      activo = false;
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, []);

  function centrarTarija() {
    mapaRef.current?.setView([CENTRO_TARIJA.latitud, CENTRO_TARIJA.longitud], 14);
  }

  return (
    <div className="ubicacion-editor">
      <div className="mapa-selector-wrap">
        <div
          ref={contenedorRef}
          className="mapa-selector"
          role="application"
          aria-label="Mapa para seleccionar la ubicación de Venta y Despacho"
        />
        {estado === 'cargando' && <div className="mapa-estado">Cargando mapa…</div>}
        {estado === 'error' && (
          <div className="mapa-estado mapa-error">
            No se pudo cargar el mapa. Comprueba la conexión e inténtalo nuevamente.
          </div>
        )}
      </div>

      <input type="hidden" name="latitud" value={punto?.latitud ?? ''} readOnly />
      <input type="hidden" name="longitud" value={punto?.longitud ?? ''} readOnly />

      <div className="ubicacion-editor-pie">
        <div>
          <strong>{punto ? 'Punto listo para guardar' : 'Selecciona el punto de despacho'}</strong>
          <span>
            {punto
              ? 'El marcador permanecerá guardado y visible cuando vuelvas al panel.'
              : 'Haz clic o toca el mapa para colocar el marcador. La vista inicial está centrada en Tarija.'}
          </span>
        </div>
        <div className="ubicacion-editor-acciones">
          <button type="button" className="boton boton-secundario" onClick={centrarTarija}>
            Centrar en Tarija
          </button>
          <BotonEnviar disabled={!punto}>
            {inicial ? 'Actualizar ubicación' : 'Guardar ubicación'}
          </BotonEnviar>
        </div>
      </div>
    </div>
  );
}

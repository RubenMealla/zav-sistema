import type { PlanificacionParada, PuntoGeografico } from './tipos';

export function fechaCorta(valor: string) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function claveFechaBolivia(valor: string | Date) {
  const fecha = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

export function esHoyBolivia(valor: string) {
  return claveFechaBolivia(valor) === claveFechaBolivia(new Date());
}

export function distanciaMetros(a: PuntoGeografico, b: PuntoGeografico) {
  const radio = 6371008.8;
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLon = rad(b.longitud - a.longitud);
  const lat1 = rad(a.latitud);
  const lat2 = rad(b.latitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radio * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatearDistancia(metros: number) {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1)} km`;
}

export function recalcularSecuencia(
  origen: PuntoGeografico,
  paradas: PlanificacionParada[],
) {
  let anterior = origen;
  let total = 0;
  const recalculadas = paradas.map((parada, indice) => {
    const distancia = distanciaMetros(anterior, parada);
    total += distancia;
    anterior = parada;
    return {
      ...parada,
      orden: indice + 1,
      distanciaDesdeAnteriorMetros: Math.round(distancia),
    };
  });
  return { paradas: recalculadas, total: Math.round(total) };
}

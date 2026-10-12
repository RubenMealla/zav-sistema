import { ES_COMPILACION_QA } from './configuracion-api';

export type SolicitudQa = {
  id: number;
  momento: string;
  metodo: string;
  ruta: string;
  codigo: number;
  duracionMs: number;
  correcta: boolean;
};

const CAPACIDAD = 80;
let siguienteId = 1;
let solicitudes: SolicitudQa[] = [];
const suscriptores = new Set<() => void>();

export function obtenerSolicitudesQa() {
  return solicitudes;
}

export function suscribirSolicitudesQa(notificar: () => void) {
  suscriptores.add(notificar);
  return () => { suscriptores.delete(notificar); };
}

export function limpiarSolicitudesQa() {
  if (!ES_COMPILACION_QA) return;
  solicitudes = [];
  suscriptores.forEach((notificar) => notificar());
}

export function registrarSolicitudQa(datos: {
  metodo: string;
  ruta: string;
  codigo: number;
  duracionMs: number;
  correcta: boolean;
}) {
  if (!ES_COMPILACION_QA) return;

  // Omitir consultas, parámetros, UUID y posibles identificadores.
  const ruta = datos.ruta
    .split('?')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .slice(0, 90);

  const registro: SolicitudQa = {
    id: siguienteId++,
    momento: new Date().toISOString(),
    metodo: datos.metodo.toUpperCase().slice(0, 8),
    ruta: ruta.startsWith('/api/v1/') ? ruta : '/api/v1/(no mostrada)',
    codigo: datos.codigo,
    duracionMs: Math.max(0, Math.round(datos.duracionMs)),
    correcta: datos.correcta,
  };
  solicitudes = [registro, ...solicitudes].slice(0, CAPACIDAD);
  suscriptores.forEach((notificar) => notificar());
}

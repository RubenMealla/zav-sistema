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

  // Solo conservar segmentos del contrato. También oculta identificadores que
  // no sean UUID, fragmentos y textos inesperados en rutas de error.
  const segmentosPublicos = new Set([
    'api', 'v1', 'auth', 'login', 'me', 'salud', 'version', 'productos', 'clientes',
    'pedidos', 'disponibilidad', 'retiro', 'retiros', 'entrega', 'cancelacion',
    'planificacion', 'estado', 'ubicacion', 'ubicaciones', 'venta-despacho',
    'geografia', 'autocompletar', 'geocodificar', 'reversa',
  ]);
  const ruta = datos.ruta
    .split(/[?#]/)[0]
    .split('/').map((segmento) => !segmento || segmentosPublicos.has(segmento) ? segmento : ':id').join('/')
    .slice(0, 90);

  const registro: SolicitudQa = {
    id: siguienteId++,
    momento: new Date().toISOString(),
    metodo: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'].includes(datos.metodo.toUpperCase())
      ? datos.metodo.toUpperCase() : 'OTRO',
    ruta: ruta.startsWith('/api/v1/') ? ruta : '/api/v1/(no mostrada)',
    codigo: datos.codigo,
    duracionMs: Math.max(0, Math.round(datos.duracionMs)),
    correcta: datos.correcta,
  };
  solicitudes = [registro, ...solicitudes].slice(0, CAPACIDAD);
  suscriptores.forEach((notificar) => notificar());
}

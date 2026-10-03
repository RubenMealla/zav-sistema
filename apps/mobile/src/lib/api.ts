import type {
  ApiErrorBody,
  Cliente,
  Disponibilidad,
  Lista,
  PedidoDetalle,
  PedidoResumen,
  PlanificacionReparto,
  PuntoGeografico,
  Sesion,
  VentaDespacho,
} from './tipos';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ??
  'https://zav-api-2026.onrender.com';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
  ) {
    const mensaje = Array.isArray(body?.message)
      ? body?.message.join(' ')
      : body?.message;
    super(mensaje || `Error HTTP ${status}`);
  }
}

async function solicitud<T>(
  ruta: string,
  opciones: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(opciones.headers);
  headers.set('Accept', 'application/json');
  if (opciones.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
      ...opciones,
      headers,
    });
  } catch {
    throw new ApiError(0, { message: 'No se pudo conectar con la API.' });
  }

  let cuerpo: unknown = null;
  const tipo = respuesta.headers.get('content-type') ?? '';
  if (tipo.includes('application/json')) {
    cuerpo = await respuesta.json();
  }

  if (!respuesta.ok) {
    throw new ApiError(
      respuesta.status,
      cuerpo && typeof cuerpo === 'object' ? (cuerpo as ApiErrorBody) : null,
    );
  }

  return cuerpo as T;
}

export function iniciarSesion(identificador: string, contrasena: string) {
  return solicitud<Sesion>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identificador, contrasena }),
  });
}

export function perfil(token: string) {
  return solicitud<Sesion['usuario']>('/api/v1/auth/me', {}, token);
}

export function listarClientes(token: string, q = '') {
  const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}&limit=100` : '?limit=100';
  return solicitud<Lista<Cliente>>(`/api/v1/clientes${query}`, {}, token);
}

export function crearCliente(
  token: string,
  datos: {
    nombre: string;
    telefono?: string;
    direccion: string;
    latitud?: number;
    longitud?: number;
  },
) {
  return solicitud<Cliente>(
    '/api/v1/clientes',
    { method: 'POST', body: JSON.stringify(datos) },
    token,
  );
}

export async function obtenerDisponibilidad(token: string) {
  const respuesta = await solicitud<{ items: Disponibilidad[] }>(
    '/api/v1/pedidos/disponibilidad',
    {},
    token,
  );
  return respuesta.items;
}

export function listarPedidos(token: string, estado?: string) {
  const params = new URLSearchParams({ limit: '100' });
  if (estado) params.set('estado', estado);
  return solicitud<Lista<PedidoResumen>>(
    `/api/v1/pedidos?${params.toString()}`,
    {},
    token,
  );
}

export function obtenerPedido(token: string, id: string) {
  return solicitud<PedidoDetalle>(`/api/v1/pedidos/${id}`, {}, token);
}

export function crearPedido(
  token: string,
  datos: {
    clienteId: string;
    direccionEntrega?: string;
    observacion?: string;
    detalles: { productoId: string; cantidad: number }[];
  },
) {
  return solicitud<PedidoDetalle>(
    '/api/v1/pedidos',
    { method: 'POST', body: JSON.stringify(datos) },
    token,
  );
}

export function retirarPedido(token: string, id: string, operacionClave: string) {
  return solicitud<PedidoDetalle>(
    `/api/v1/pedidos/${id}/retiro`,
    { method: 'POST', body: JSON.stringify({ operacionClave }) },
    token,
  );
}

export function entregarPedido(
  token: string,
  id: string,
  datos: { operacionClave: string; latitud: number; longitud: number },
) {
  return solicitud<PedidoDetalle>(
    `/api/v1/pedidos/${id}/entrega`,
    { method: 'POST', body: JSON.stringify(datos) },
    token,
  );
}


export function actualizarUbicacionCliente(
  token: string,
  id: string,
  datos: PuntoGeografico & { direccion?: string },
) {
  return solicitud<Cliente>(
    `/api/v1/clientes/${id}/ubicacion`,
    { method: 'PATCH', body: JSON.stringify(datos) },
    token,
  );
}

export function obtenerVentaDespacho(token: string) {
  return solicitud<VentaDespacho>('/api/v1/ubicaciones/venta-despacho', {}, token);
}

export function planificarReparto(
  token: string,
  datos:
    | { pedidoIds: string[]; origenTipo: 'DESPACHO' }
    | {
        pedidoIds: string[];
        origenTipo: 'ACTUAL';
        origenLatitud: number;
        origenLongitud: number;
      },
) {
  return solicitud<PlanificacionReparto>(
    '/api/v1/pedidos/planificacion',
    { method: 'POST', body: JSON.stringify(datos) },
    token,
  );
}

export function entregarPedidoConComprobacion(
  token: string,
  id: string,
  datos: {
    operacionClave: string;
    latitud: number;
    longitud: number;
    precisionMetros?: number;
    observacionDistancia?: string;
  },
) {
  return solicitud<PedidoDetalle>(
    `/api/v1/pedidos/${id}/entrega`,
    { method: 'POST', body: JSON.stringify(datos) },
    token,
  );
}

import type {
  ApiErrorBody,
  Cliente,
  Disponibilidad,
  Lista,
  PedidoDetalle,
  PedidoResumen,
  PlanificacionReparto,
  PuntoGeografico,
  ResultadoRetiroMultiple,
  Sesion,
  VentaDespacho,
} from './tipos';

import { obtenerDireccionApi } from './configuracion-api';
import { registrarSolicitudQa } from './diagnostico-qa';
import type { CustodiaLibre,OperacionDetalle,OperacionResumen,StockLibre } from './operaciones-tipos';

export function consultarStockLibre(token:string) {return solicitud<{items:StockLibre[]}>('/api/v1/operaciones/disponibilidad',{},token);}
export function consultarCustodia(token:string,page=1) {return solicitud<{items:CustodiaLibre[]}>('/api/v1/operaciones/custodia?limit=50&page='+page,{},token);}
export function consultarOperaciones(token:string,page=1) {return solicitud<{items:OperacionResumen[];total:number}>('/api/v1/operaciones?limit=20&page='+page,{},token);}
export function consultarOperacion(token:string,id:string) {return solicitud<OperacionDetalle>('/api/v1/operaciones/'+encodeURIComponent(id),{},token);}
export function enviarOperacion(token:string,ruta:string,datos:Record<string,unknown>) {
  if(!/^operaciones\/(salidas-directas|devoluciones|[a-f0-9-]{36}\/recepcion)$/.test(ruta)) throw new Error('Operación móvil no permitida.');
  return solicitud<OperacionDetalle>('/api/v1/'+ruta,{method:'POST',body:JSON.stringify(datos)},token);
}

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
  const inicio = Date.now();
  const metodo = opciones.method ?? 'GET';
  let codigo = 0;
  let correcta = false;
  const controlador = new AbortController();
  const cancelar = () => controlador.abort();
  opciones.signal?.addEventListener('abort', cancelar, { once: true });
  if (opciones.signal?.aborted) cancelar();
  const timeout = setTimeout(cancelar, ruta === '/api/v1/pedidos/retiros' ? 120_000 : 60_000);

  try {
    const base = obtenerDireccionApi();
    if (!/^https?:\/\/[^\s/]+/i.test(base)) {
      throw new ApiError(0, { message: 'Configura EXPO_PUBLIC_API_BASE_URL para conectar con la API.' });
    }
    const headers = new Headers(opciones.headers);
    headers.set('Accept', 'application/json');
    if (opciones.body) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', 'Bearer ' + token);

    let respuesta: Response;
    try {
      respuesta = await fetch(base + ruta, { ...opciones, headers, signal: controlador.signal });
    } catch {
      throw new ApiError(0, { message: controlador.signal.aborted
        ? 'Tiempo de espera agotado. Actualiza los datos para comprobar el resultado antes de reintentar.'
        : 'No se pudo conectar con la API.' });
    }
    codigo = respuesta.status;

    let cuerpo: unknown = null;
    const tipo = respuesta.headers.get('content-type') ?? '';
    if (respuesta.ok && respuesta.status !== 204 && !tipo.includes('application/json')) {
      throw new ApiError(502, { message: 'La API devolvió una respuesta que no es JSON.' });
    }
    if (tipo.includes('application/json')) {
      try {
        cuerpo = await respuesta.json();
      } catch {
        throw new ApiError(respuesta.ok ? 502 : respuesta.status, { message: 'La API devolvió una respuesta incompleta o inválida.' });
      }
    }
    if (!respuesta.ok) {
      throw new ApiError(
        respuesta.status,
        cuerpo && typeof cuerpo === 'object' ? (cuerpo as ApiErrorBody) : null,
      );
    }
    correcta = true;
    return cuerpo as T;
  } finally {
    clearTimeout(timeout);
    opciones.signal?.removeEventListener('abort', cancelar);
    registrarSolicitudQa({
      metodo, ruta, codigo,
      correcta,
      duracionMs: Date.now() - inicio,
    });
  }
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

export function listarClientes(
  token: string,
  q = '',
  activo?: 'true' | 'false' | 'todos',
  page = 1,
) {
  const params = new URLSearchParams({ limit: '100', page: String(page) });
  if (q.trim()) params.set('q', q.trim());
  if (activo) params.set('activo', activo);
  return solicitud<Lista<Cliente>>(
    `/api/v1/clientes?${params.toString()}`,
    {},
    token,
  );
}

export async function listarDirectorioClientes(token: string, q = '') {
  let pagina = await listarClientes(token, q, 'todos');
  const porId = new Map<string, Cliente>();
  for (const cliente of pagina.items) porId.set(cliente.id, cliente);
  while (pagina.page * pagina.limit < pagina.total && pagina.items.length) {
    pagina = await listarClientes(token, q, 'todos', pagina.page + 1);
    for (const cliente of pagina.items) porId.set(cliente.id, cliente);
  }
  const items = [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return {
    items,
    total: items.length,
    page: 1,
    limit: Math.max(100, items.length),
  } satisfies Lista<Cliente>;
}

export function crearCliente(
  token: string,
  datos: {
    nombre: string;
    telefono?: string;
    direccion: string;
    latitud: number;
    longitud: number;
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

export function listarPedidos(
  token: string,
  estado?: string,
  page = 1,
  limit = 100,
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (estado) params.set('estado', estado);
  return solicitud<Lista<PedidoResumen>>(
    `/api/v1/pedidos?${params.toString()}`,
    {},
    token,
  );
}

export function listarPedidosActivos(token: string, page = 1) {
  return listarPedidos(token, 'ACTIVOS', page, 100);
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

export function retirarPedidosSeleccionados(
  token: string,
  retiros: { pedidoId: string; operacionClave: string }[],
) {
  return solicitud<ResultadoRetiroMultiple>(
    '/api/v1/pedidos/retiros',
    { method: 'POST', body: JSON.stringify({ retiros }) },
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


export function actualizarCliente(
  token: string,
  id: string,
  datos: {
    nombre: string;
    telefono?: string;
    direccion: string;
    latitud: number;
    longitud: number;
  },
) {
  return solicitud<Cliente>(
    `/api/v1/clientes/${id}`,
    { method: 'PATCH', body: JSON.stringify(datos) },
    token,
  );
}

export function cambiarEstadoCliente(token: string, id: string, activo: boolean) {
  return solicitud<Cliente>(
    `/api/v1/clientes/${id}/estado`,
    { method: 'PATCH', body: JSON.stringify({ activo }) },
    token,
  );
}

export function actualizarPedido(
  token: string,
  id: string,
  datos: {
    clienteId: string;
    direccionEntrega?: string;
    observacion?: string;
    detalles: { productoId: string; cantidad: number }[];
  },
) {
  return solicitud<PedidoDetalle>(
    `/api/v1/pedidos/${id}`,
    { method: 'PATCH', body: JSON.stringify(datos) },
    token,
  );
}

export function cancelarPedido(token: string, id: string, motivo?: string) {
  return solicitud<PedidoDetalle>(
    `/api/v1/pedidos/${id}/cancelacion`,
    { method: 'POST', body: JSON.stringify({ motivo }) },
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

export type DireccionGeocodificada = {
  direccion: string;
  principal: string;
  secundaria: string;
  tipo: string;
  departamento: string | null;
  ciudad: string | null;
  paisCodigo: string | null;
  latitud: number;
  longitud: number;
};

export function autocompletarDirecciones(token: string, consulta: string) {
  return solicitud<{
    proveedor: 'GEOAPIFY';
    alcance: 'TARIJA_BOLIVIA';
    resultados: DireccionGeocodificada[];
  }>(
    `/api/v1/geografia/autocompletar?q=${encodeURIComponent(consulta.trim())}`,
    {},
    token,
  );
}

export function buscarDirecciones(token: string, consulta: string) {
  return solicitud<{
    proveedor: 'GEOAPIFY';
    alcance: 'TARIJA_BOLIVIA';
    resultados: DireccionGeocodificada[];
  }>(
    `/api/v1/geografia/geocodificar?q=${encodeURIComponent(consulta.trim())}`,
    {},
    token,
  );
}

export function direccionInversa(token: string, punto: PuntoGeografico) {
  const params = new URLSearchParams({
    latitud: String(punto.latitud),
    longitud: String(punto.longitud),
  });
  return solicitud<{
    proveedor: 'GEOAPIFY';
    alcance: 'TARIJA_BOLIVIA';
    direccion: string | null;
    paisCodigo: string | null;
  }>(
    `/api/v1/geografia/reversa?${params.toString()}`,
    {},
    token,
  );
}

export type Rol = 'ADMINISTRADOR' | 'VENDEDOR';

export type UsuarioSesion = {
  id: string;
  identificador: string;
  nombre: string;
  rol: Rol;
};

export type Sesion = {
  accessToken: string;
  expiresIn: number;
  usuario: UsuarioSesion;
};

export type PuntoGeografico = {
  latitud: number;
  longitud: number;
};

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  direccion: string;
  ubicacion:
    | (PuntoGeografico & {
        confirmadaEn: string | null;
      })
    | null;
  activo: boolean;
};

export type Disponibilidad = {
  productoId: string;
  codigo: string;
  nombre: string;
  familia: string;
  presentacion: string;
  pesoGramos: number;
  precioBob: string;
  cantidadFisica: number;
  cantidadComprometida: number;
  cantidadDisponible: number;
};

export type EstadoPedido = 'REGISTRADO' | 'EN_DISTRIBUCION' | 'ENTREGADO' | 'CANCELADO';

export type PedidoResumen = {
  id: string;
  estado: EstadoPedido;
  direccionEntrega: string;
  destinoGps: PuntoGeografico | null;
  creadoEn: string;
  retiradoEn: string | null;
  entregadoEn: string | null;
  cliente: { id: string; nombre: string };
  unidades: number;
  totalBob: string;
};

export type PedidoDetalle = {
  id: string;
  estado: EstadoPedido;
  direccionEntrega: string;
  destinoGps: PuntoGeografico | null;
  observacion: string | null;
  creadoEn: string;
  retiradoEn: string | null;
  entregadoEn: string | null;
  canceladoEn: string | null;
  cancelacionMotivo: string | null;
  entregaGps:
    | (PuntoGeografico & {
        precisionMetros: number | null;
        distanciaDestinoMetros: number | null;
        observacion: string | null;
      })
    | null;
  cliente: { id: string; nombre: string; telefono: string | null };
  vendedor: { id: string; nombre: string };
  detalles: {
    id: string;
    productoId: string;
    codigo: string;
    nombre: string;
    cantidad: number;
    precioUnitarioBob: string;
    subtotalBob: string;
  }[];
  totalBob: string;
};

export type ResultadoRetiroMultiple = {
  resultado: 'COMPLETO' | 'PARCIAL' | 'SIN_CAMBIOS';
  exitosos: number;
  fallidos: number;
  items: {
    pedidoId: string;
    ok: boolean;
    estado?: EstadoPedido;
    statusCode?: number;
    message?: string;
  }[];
};

export type VentaDespacho = {
  id: string;
  codigo: 'VENTA_DESPACHO';
  nombre: string;
  clase: 'AREA_FISICA';
  ubicacion: PuntoGeografico | null;
};

export type PlanificacionParada = PuntoGeografico & {
  pedidoId: string;
  clienteId: string;
  clienteNombre: string;
  direccionEntrega: string;
  orden: number;
  distanciaDesdeAnteriorMetros: number;
};

export type PlanificacionReparto = {
  algoritmo: 'VECINO_MAS_CERCANO_HAVERSINE';
  naturaleza: 'SECUENCIA_GEOGRAFICA_SUGERIDA';
  origen: PuntoGeografico & { tipo: 'DESPACHO' | 'ACTUAL' };
  distanciaTotalAproximadaMetros: number;
  paradas: PlanificacionParada[];
  limitacion: string;
};

export type Lista<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type ApiErrorBody = {
  statusCode?: number;
  error?: string;
  message?: string | string[];
  path?: string;
  timestamp?: string;
};

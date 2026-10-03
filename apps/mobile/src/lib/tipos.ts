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

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  direccion: string;
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

export type EstadoPedido = 'REGISTRADO' | 'EN_DISTRIBUCION' | 'ENTREGADO';

export type PedidoResumen = {
  id: string;
  estado: EstadoPedido;
  direccionEntrega: string;
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
  observacion: string | null;
  creadoEn: string;
  retiradoEn: string | null;
  entregadoEn: string | null;
  entregaGps: { latitud: number; longitud: number } | null;
  cliente: { id: string; nombre: string; telefono: string | null };
  vendedor: { id: string; nombre: string };
  detalles: Array<{
    id: string;
    productoId: string;
    codigo: string;
    nombre: string;
    cantidad: number;
    precioUnitarioBob: string;
    subtotalBob: string;
  }>;
  totalBob: string;
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

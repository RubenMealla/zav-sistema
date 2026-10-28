export type StockLibre = {
  productoId: string;
  codigo: string;
  nombre: string;
  presentacion: string;
  cantidadDisponible: number;
};
export type CustodiaLibre = {
  vendedorId: string;
  loteId: string;
  loteCodigo: string;
  productoId: string;
  nombre: string;
  codigo: string;
  presentacion: string;
  finalidad: "LIBRE" | "PEDIDO";
  cantidad: number;
  libre: number;
  pendiente: number;
  condicion: string;
  venceEl: string;
  elegible: boolean;
};
export type OperacionResumen = {
  id: string;
  tipo: "SALIDA_DIRECTA" | "CARGA" | "DEVOLUCION" | "REVERSION";
  estado: "CONFIRMADA" | "PENDIENTE_RECEPCION";
  creadoEn: string;
  responsable: string;
  vendedorNombre: string | null;
  unidades: number;
  reversionId: string | null;
};
export type OperacionDetalle = OperacionResumen & {
  operacionClave: string;
  latitud: string | null;
  longitud: string | null;
  precisionM: string | null;
  clienteNombre: string | null;
  motivo: string | null;
  detalles: {
    productoId: string;
    cantidad: number;
    precioUnitarioBob: string | null;
    productoHistorico: { nombre: string; codigo: string; presentacion: string };
    lotes: {
      loteId: string;
      codigo: string;
      cantidad: number;
      condicionAlRegistrar: string;
      movimientoId: string | null;
    }[];
  }[];
  eventos: { accion: string; responsable: string; creadoEn: string }[];
};
export type OperacionPendiente = {
  version: 1;
  ruta: string;
  datos: Record<string, unknown>;
  resumen: string;
};

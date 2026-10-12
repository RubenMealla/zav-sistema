export type EstadoPedido = 'REGISTRADO' | 'EN_DISTRIBUCION' | 'ENTREGADO' | 'CANCELADO';

export type DetalleEntrada = {
  productoId: string;
  cantidad: number;
};

export type FilaPedido = {
  id: string;
  cliente_id: string;
  vendedor_id: string;
  estado: EstadoPedido;
  direccion_entrega: string;
  observacion: string | null;
  destino_latitud: string | null;
  destino_longitud: string | null;
  retiro_operacion_clave: string | null;
  retirado_en: Date | null;
  entrega_operacion_clave: string | null;
  entregado_en: Date | null;
  entrega_latitud: string | null;
  entrega_longitud: string | null;
  entrega_precision_m: string | null;
  entrega_distancia_destino_m: string | null;
  entrega_observacion: string | null;
  cancelado_en: Date | null;
  cancelacion_motivo: string | null;
  creado_en: Date;
  actualizado_en: Date;
  cliente_nombre: string;
  cliente_telefono: string | null;
  vendedor_nombre: string;
};

export type FilaDetalle = {
  id: string;
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario_bob: string;
  subtotal_bob: string;
};

export type FilaDisponibilidad = {
  id: string;
  codigo: string;
  nombre: string;
  familia: string;
  presentacion: string;
  peso_gramos: number;
  precio_bob: string;
  fisico: number;
  comprometido: number;
  disponible: number;
};

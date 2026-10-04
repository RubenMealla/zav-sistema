import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type EstadoPedido = 'REGISTRADO' | 'EN_DISTRIBUCION' | 'ENTREGADO';

@Entity({ name: 'pedido' })
@Index('idx_pedido_cliente_id', ['clienteId'])
@Index('idx_pedido_vendedor_estado', ['vendedorId', 'estado'])
@Unique('uq_pedido_retiro_operacion', ['retiroOperacionClave'])
@Unique('uq_pedido_entrega_operacion', ['entregaOperacionClave'])
@Check('chk_pedido_estado', '"estado" IN (\'REGISTRADO\', \'EN_DISTRIBUCION\', \'ENTREGADO\')')
@Check('chk_pedido_direccion', 'length(trim("direccion_entrega")) > 0')
@Check('chk_pedido_latitud', '"entrega_latitud" IS NULL OR ("entrega_latitud" >= -90 AND "entrega_latitud" <= 90)')
@Check('chk_pedido_longitud', '"entrega_longitud" IS NULL OR ("entrega_longitud" >= -180 AND "entrega_longitud" <= 180)')
export class PedidoEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'cliente_id', type: 'uuid' })
  clienteId!: string;

  @Column({ name: 'vendedor_id', type: 'uuid' })
  vendedorId!: string;

  @Column({ type: 'varchar', length: 30, default: 'REGISTRADO' })
  estado!: EstadoPedido;

  @Column({ name: 'direccion_entrega', type: 'varchar', length: 240 })
  direccionEntrega!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  observacion!: string | null;

  @Column({ name: 'destino_latitud', type: 'numeric', precision: 9, scale: 6, nullable: true })
  destinoLatitud!: string | null;

  @Column({ name: 'destino_longitud', type: 'numeric', precision: 9, scale: 6, nullable: true })
  destinoLongitud!: string | null;

  @Column({ name: 'retiro_operacion_clave', type: 'uuid', nullable: true })
  retiroOperacionClave!: string | null;

  @Column({ name: 'retirado_en', type: 'timestamptz', nullable: true })
  retiradoEn!: Date | null;

  @Column({ name: 'entrega_operacion_clave', type: 'uuid', nullable: true })
  entregaOperacionClave!: string | null;

  @Column({ name: 'entregado_en', type: 'timestamptz', nullable: true })
  entregadoEn!: Date | null;

  @Column({ name: 'entrega_latitud', type: 'numeric', precision: 9, scale: 6, nullable: true })
  entregaLatitud!: string | null;

  @Column({ name: 'entrega_longitud', type: 'numeric', precision: 9, scale: 6, nullable: true })
  entregaLongitud!: string | null;

  @Column({ name: 'entrega_precision_m', type: 'numeric', precision: 10, scale: 2, nullable: true })
  entregaPrecisionM!: string | null;

  @Column({ name: 'entrega_distancia_destino_m', type: 'numeric', precision: 12, scale: 2, nullable: true })
  entregaDistanciaDestinoM!: string | null;

  @Column({ name: 'entrega_observacion', type: 'varchar', length: 300, nullable: true })
  entregaObservacion!: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}

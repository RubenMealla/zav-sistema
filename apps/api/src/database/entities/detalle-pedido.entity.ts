import {
  Check,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'detalle_pedido' })
@Unique('uq_detalle_pedido_producto', ['pedidoId', 'productoId'])
@Index('idx_detalle_pedido_producto_id', ['productoId'])
@Check('chk_detalle_pedido_cantidad', '"cantidad" > 0')
@Check('chk_detalle_pedido_precio', '"precio_unitario_bob" >= 0')
export class DetallePedidoEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'pedido_id', type: 'uuid' })
  pedidoId!: string;

  @Column({ name: 'producto_id', type: 'uuid' })
  productoId!: string;

  @Column({ type: 'integer' })
  cantidad!: number;

  @Column({ name: 'precio_unitario_bob', type: 'numeric', precision: 12, scale: 2 })
  precioUnitarioBob!: string;
}

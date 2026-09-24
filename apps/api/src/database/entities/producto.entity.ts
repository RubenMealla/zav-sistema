import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'producto' })
@Unique('uq_producto_codigo', ['codigo'])
@Check('chk_producto_peso_gramos', '"peso_gramos" > 0')
@Check('chk_producto_precio_bob', '"precio_bob" >= 0')
export class ProductoEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  codigo!: string;

  @Column({ type: 'varchar', length: 120 })
  nombre!: string;

  @Column({ type: 'varchar', length: 70 })
  familia!: string;

  @Column({ type: 'varchar', length: 100 })
  presentacion!: string;

  @Column({ name: 'peso_gramos', type: 'integer' })
  pesoGramos!: number;

  // El controlador pg devuelve NUMERIC como cadena para conservar la precisión.
  @Column({ name: 'precio_bob', type: 'numeric', precision: 12, scale: 2 })
  precioBob!: string;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}

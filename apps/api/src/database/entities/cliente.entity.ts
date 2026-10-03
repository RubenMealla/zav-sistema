import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'cliente' })
@Index('idx_cliente_nombre', ['nombre'])
@Check('chk_cliente_nombre', 'length(trim("nombre")) > 0')
@Check('chk_cliente_direccion', 'length(trim("direccion")) > 0')
export class ClienteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 140 })
  nombre!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono!: string | null;

  @Column({ type: 'varchar', length: 240 })
  direccion!: string;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  latitud!: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  longitud!: string | null;

  @Column({ name: 'ubicacion_confirmada_en', type: 'timestamptz', nullable: true })
  ubicacionConfirmadaEn!: Date | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}

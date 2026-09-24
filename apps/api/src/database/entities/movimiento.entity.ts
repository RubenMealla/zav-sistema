import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'movimiento' })
@Unique('uq_movimiento_operacion_clave', ['operacionClave'])
@Index('idx_movimiento_lote_id', ['loteId'])
@Index('idx_movimiento_usuario_id', ['usuarioId'])
@Check('chk_movimiento_cantidad', '"cantidad" > 0')
@Check('chk_movimiento_ingreso', '"tipo" <> \'INGRESO\' OR ("origen_id" IS NULL AND "destino_id" IS NOT NULL)')
export class MovimientoEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'operacion_clave', type: 'uuid' })
  operacionClave!: string;

  @Column({ name: 'lote_id', type: 'uuid' })
  loteId!: string;

  @Column({ type: 'varchar', length: 30 })
  tipo!: string;

  @Column({ name: 'origen_id', type: 'uuid', nullable: true })
  origenId!: string | null;

  @Column({ name: 'destino_id', type: 'uuid', nullable: true })
  destinoId!: string | null;

  @Column({ type: 'integer' })
  cantidad!: number;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  referencia!: string | null;

  @Column({ type: 'varchar', length: 250, nullable: true })
  motivo!: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}

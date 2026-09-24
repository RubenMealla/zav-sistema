import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'lote' })
@Unique('uq_lote_codigo', ['codigo'])
@Index('idx_lote_producto_id', ['productoId'])
@Check('chk_lote_fechas', '"vence_el" > "elaborado_el"')
@Check('chk_lote_condicion', '"condicion" IN (\'LIBERADO\', \'RETENIDO\', \'BLOQUEADO\')')
export class LoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 60 })
  codigo!: string;

  // La FK hacia producto.id se creará mediante una migración versionada.
  @Column({ name: 'producto_id', type: 'uuid' })
  productoId!: string;

  // DATE se representa como YYYY-MM-DD, no como instante UTC.
  @Column({ name: 'elaborado_el', type: 'date' })
  elaboradoEl!: string;

  @Column({ name: 'vence_el', type: 'date' })
  venceEl!: string;

  @Column({ type: 'varchar', length: 20, default: 'RETENIDO' })
  condicion!: 'LIBERADO' | 'RETENIDO' | 'BLOQUEADO';

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}

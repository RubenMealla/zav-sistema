import {
  Check,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'existencia' })
@Unique('uq_existencia_lote_ubicacion', ['loteId', 'ubicacionId'])
@Index('idx_existencia_ubicacion_id', ['ubicacionId'])
@Check('chk_existencia_cantidad_fisica', '"cantidad_fisica" >= 0')
@Check('chk_existencia_cantidad_comprometida', '"cantidad_comprometida" >= 0 AND "cantidad_comprometida" <= "cantidad_fisica"')
export class ExistenciaEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Las FK se añadirán en la migración, junto con las restricciones SQL.
  @Column({ name: 'lote_id', type: 'uuid' })
  loteId!: string;

  @Column({ name: 'ubicacion_id', type: 'uuid' })
  ubicacionId!: string;

  @Column({ name: 'cantidad_fisica', type: 'integer' })
  cantidadFisica!: number;

  @Column({ name: 'cantidad_comprometida', type: 'integer', default: 0 })
  cantidadComprometida!: number;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}

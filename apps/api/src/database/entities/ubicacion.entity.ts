import {
  Check,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'ubicacion' })
@Unique('uq_ubicacion_codigo', ['codigo'])
@Check('chk_ubicacion_clase', '"clase" IN (\'AREA_FISICA\', \'CUSTODIA_LOGICA\')')
export class UbicacionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  codigo!: string;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 20 })
  clase!: 'AREA_FISICA' | 'CUSTODIA_LOGICA';

  @Column({ name: 'permite_venta', type: 'boolean' })
  permiteVenta!: boolean;

  @Column({ name: 'activa', type: 'boolean', default: true })
  activa!: boolean;
}

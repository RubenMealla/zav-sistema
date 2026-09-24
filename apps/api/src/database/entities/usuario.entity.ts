import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'usuario' })
@Unique('uq_usuario_identificador', ['identificador'])
@Check('chk_usuario_rol', '"rol" IN (\'ADMINISTRADOR\', \'VENDEDOR\')')
@Check('chk_usuario_identificador_minusculas', '"identificador" = lower("identificador")')
export class UsuarioEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'nombre', type: 'varchar', length: 120 })
  nombre!: string;

  @Column({ name: 'identificador', type: 'varchar', length: 120 })
  identificador!: string;

  @Column({ name: 'contrasena_hash', type: 'varchar', length: 255, select: false })
  contrasenaHash!: string;

  @Column({ name: 'rol', type: 'varchar', length: 20 })
  rol!: 'ADMINISTRADOR' | 'VENDEDOR';

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}

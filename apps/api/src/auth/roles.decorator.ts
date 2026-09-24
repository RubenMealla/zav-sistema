import { SetMetadata } from '@nestjs/common';
import { UsuarioEntity } from '../database/entities/usuario.entity.js';

export const ROLES_KEY = 'zav:roles';
export type Rol = UsuarioEntity['rol'];
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

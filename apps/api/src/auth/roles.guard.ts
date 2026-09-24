import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Rol } from './roles.decorator.js';
import { SolicitudAutenticada } from './jwt-auth.guard.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permitidos = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permitidos?.length) return true;
    const solicitud = context.switchToHttp().getRequest<SolicitudAutenticada>();
    if (!solicitud.usuario || !permitidos.includes(solicitud.usuario.rol)) {
      throw new ForbiddenException('No tienes permiso para esta operacion.');
    }
    return true;
  }
}

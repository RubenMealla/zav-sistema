import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioEntity } from '../database/entities/usuario.entity.js';

export interface SolicitudAutenticada {
  headers: { authorization?: string };
  usuario?: UsuarioEntity;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(UsuarioEntity)
    private readonly usuarios: Repository<UsuarioEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const solicitud = context.switchToHttp().getRequest<SolicitudAutenticada>();
    const cabecera = solicitud.headers.authorization;
    const token = typeof cabecera === 'string' ? /^Bearer ([^\s]+)$/.exec(cabecera)?.[1] : undefined;
    if (!token) throw new UnauthorizedException('No autenticado.');

    let sub: unknown;
    try {
      const contenido = await this.jwt.verifyAsync<{ sub?: unknown }>(token);
      sub = contenido.sub;
    } catch {
      throw new UnauthorizedException('Token invalido o vencido.');
    }
    if (typeof sub !== 'string') throw new UnauthorizedException('Token invalido.');

    // Reconsultar la cuenta impide usar un JWT de un usuario desactivado.
    const usuario = await this.usuarios.findOne({ where: { id: sub, activo: true } });
    if (!usuario) throw new UnauthorizedException('Cuenta no disponible.');
    solicitud.usuario = usuario;
    return true;
  }
}

import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { SolicitudAutenticada } from './jwt-auth.guard.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly autenticacion: AuthService) {}

  @Post('login')
  iniciarSesion(@Body() cuerpo: unknown) {
    return this.autenticacion.iniciarSesion(cuerpo);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  perfil(@Req() solicitud: SolicitudAutenticada) {
    const usuario = solicitud.usuario!;
    return {
      id: usuario.id,
      identificador: usuario.identificador,
      nombre: usuario.nombre,
      rol: usuario.rol,
    };
  }
}

import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { SolicitudAutenticada } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { MovimientosService } from './movimientos-saldos.service.js';

@Controller('api/v1/movimientos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class MovimientosE3Controller {
  constructor(private readonly movimientos: MovimientosService) {}

  @Post('traslado')
  trasladar(@Body() datos: unknown, @Req() solicitud: SolicitudAutenticada) {
    return this.movimientos.trasladar(datos, solicitud.usuario!.id);
  }

  @Get()
  listar(@Query() consulta: Record<string, unknown>) {
    return this.movimientos.listar(consulta);
  }
}

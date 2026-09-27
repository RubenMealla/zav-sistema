import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { SolicitudAutenticada } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CondicionesLoteService } from './condiciones-lote.service.js';

@Controller('api/v1/lotes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class CondicionesLoteController {
  constructor(private readonly condiciones: CondicionesLoteService) {}

  @Post(':id/liberar')
  liberar(
    @Param('id') id: string,
    @Body() datos: unknown,
    @Req() solicitud: SolicitudAutenticada,
  ) {
    return this.condiciones.liberar(id, datos, solicitud.usuario!.id);
  }

  @Post(':id/bloquear')
  bloquear(
    @Param('id') id: string,
    @Body() datos: unknown,
    @Req() solicitud: SolicitudAutenticada,
  ) {
    return this.condiciones.bloquear(id, datos, solicitud.usuario!.id);
  }

  @Get(':id/condiciones')
  listar(@Param('id') id: string, @Query() consulta: Record<string, unknown>) {
    return this.condiciones.listar(id, consulta);
  }
}

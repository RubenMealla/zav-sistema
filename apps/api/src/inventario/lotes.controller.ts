import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { SolicitudAutenticada } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { LotesService } from './lotes.service.js';

@Controller('api/v1/lotes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class LotesController {
  constructor(private readonly lotes: LotesService) {}

  @Post()
  crear(@Body() datos: unknown, @Req() solicitud: SolicitudAutenticada) {
    return this.lotes.crear(datos, solicitud.usuario!.id);
  }

  @Get()
  listar(@Query() consulta: Record<string, unknown>) {
    return this.lotes.listar(consulta);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.lotes.obtener(id);
  }
}

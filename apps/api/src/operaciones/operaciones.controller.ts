import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  type SolicitudAutenticada,
} from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { OperacionesService } from './operaciones.service.js';

@Controller('api/v1/operaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR', 'VENDEDOR')
export class OperacionesController {
  constructor(private readonly operaciones: OperacionesService) {}
  @Get('disponibilidad') disponibilidad(@Req() r: SolicitudAutenticada) {
    return this.operaciones.disponibilidad(r.usuario!);
  }
  @Get('custodia') custodia(
    @Req() r: SolicitudAutenticada,
    @Query() q: Record<string, unknown>,
  ) {
    return this.operaciones.custodia(r.usuario!, q);
  }
  @Get('vendedores') @Roles('ADMINISTRADOR') vendedores(
    @Req() r: SolicitudAutenticada,
  ) {
    return this.operaciones.vendedores(r.usuario!);
  }
  @Get('conciliacion') @Roles('ADMINISTRADOR') conciliacion(
    @Req() r: SolicitudAutenticada,
  ) {
    return this.operaciones.conciliacion(r.usuario!);
  }
  @Get() listar(
    @Req() r: SolicitudAutenticada,
    @Query() q: Record<string, unknown>,
  ) {
    return this.operaciones.listar(r.usuario!, q);
  }
  @Get(':id') obtener(@Param('id') id: string, @Req() r: SolicitudAutenticada) {
    return this.operaciones.obtener(id, r.usuario!);
  }
  @Post('salidas-directas') salida(
    @Body() d: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.operaciones.crear('SALIDA_DIRECTA', d, r.usuario!);
  }
  @Post('cargas') @Roles('ADMINISTRADOR') carga(
    @Body() d: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.operaciones.crear('CARGA', d, r.usuario!);
  }
  @Post('devoluciones') @Roles('VENDEDOR') devolver(
    @Body() d: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.operaciones.devolver(d, r.usuario!);
  }
  @Post(':id/recepcion') @Roles('VENDEDOR') recepcion(
    @Param('id') id: string,
    @Body() d: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.operaciones.recibir(id, 'RECEPCION_CARGA', d, r.usuario!);
  }
  @Post(':id/recibir-devolucion') @Roles('ADMINISTRADOR') recibirDevolucion(
    @Param('id') id: string,
    @Body() d: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.operaciones.recibir(id, 'RECEPCION_DEVOLUCION', d, r.usuario!);
  }
  @Post(':id/reversion') @Roles('ADMINISTRADOR') revertir(
    @Param('id') id: string,
    @Body() d: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.operaciones.revertir(id, d, r.usuario!);
  }
}

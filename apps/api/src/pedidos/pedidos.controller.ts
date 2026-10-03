import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { SolicitudAutenticada } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PedidosService } from './pedidos.service.js';

@Controller('api/v1/pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDEDOR')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  @Get('disponibilidad')
  disponibilidad() {
    return this.pedidos.disponibilidad();
  }

  @Post()
  crear(@Body() datos: unknown, @Req() solicitud: SolicitudAutenticada) {
    return this.pedidos.crear(datos, solicitud.usuario!.id);
  }

  @Get()
  listar(@Req() solicitud: SolicitudAutenticada, @Query() consulta: Record<string, unknown>) {
    return this.pedidos.listar(solicitud.usuario!.id, consulta);
  }

  @Post('retiros')
  retirarVarios(@Body() datos: unknown, @Req() solicitud: SolicitudAutenticada) {
    return this.pedidos.retirarVarios(datos, solicitud.usuario!.id);
  }

  @Post(':id/retiro')
  retirar(
    @Param('id') id: string,
    @Body() datos: unknown,
    @Req() solicitud: SolicitudAutenticada,
  ) {
    return this.pedidos.retirar(id, datos, solicitud.usuario!.id);
  }

  @Post(':id/entrega')
  entregar(
    @Param('id') id: string,
    @Body() datos: unknown,
    @Req() solicitud: SolicitudAutenticada,
  ) {
    return this.pedidos.entregar(id, datos, solicitud.usuario!.id);
  }

  @Get(':id')
  obtener(@Param('id') id: string, @Req() solicitud: SolicitudAutenticada) {
    return this.pedidos.obtener(id, solicitud.usuario!.id);
  }
}

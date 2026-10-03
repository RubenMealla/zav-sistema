import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { SolicitudAutenticada } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { GeografiaService } from './geografia.service.js';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GeografiaController {
  constructor(private readonly geografia: GeografiaService) {}

  @Get('ubicaciones/venta-despacho')
  @Roles('VENDEDOR', 'ADMINISTRADOR')
  ventaDespacho() {
    return this.geografia.ventaDespacho();
  }

  @Patch('ubicaciones/:id/georreferencia')
  @Roles('ADMINISTRADOR')
  actualizarUbicacionFisica(@Param('id') id: string, @Body() datos: unknown) {
    return this.geografia.actualizarUbicacionFisica(id, datos);
  }

  @Get('geografia/geocodificar')
  @Roles('VENDEDOR')
  geocodificar(@Query('q') consulta: string | undefined) {
    return this.geografia.geocodificar(consulta);
  }

  @Get('geografia/reversa')
  @Roles('VENDEDOR')
  geocodificacionInversa(
    @Query('latitud') latitud: string | undefined,
    @Query('longitud') longitud: string | undefined,
  ) {
    return this.geografia.geocodificacionInversa(latitud, longitud);
  }

  @Post('pedidos/planificacion')
  @Roles('VENDEDOR')
  planificar(@Body() datos: unknown, @Req() solicitud: SolicitudAutenticada) {
    return this.geografia.planificar(datos, solicitud.usuario!.id);
  }
}

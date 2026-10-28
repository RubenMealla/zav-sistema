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
import {
  JwtAuthGuard,
  type SolicitudAutenticada,
} from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ProductosService } from './productos.service.js';

@Controller('api/v1/productos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Post()
  crear(@Body() datos: unknown, @Req() r: SolicitudAutenticada) {
    return this.productos.crear(datos, r.usuario!.id);
  }

  @Get()
  @Roles('ADMINISTRADOR', 'VENDEDOR')
  listar(@Query() consulta: Record<string, unknown>) {
    return this.productos.listar(consulta);
  }

  @Patch(':id/baja')
  darBaja(@Param('id') id: string, @Req() r: SolicitudAutenticada) {
    return this.productos.darBaja(id, r.usuario!.id);
  }

  @Patch(':id')
  editar(
    @Param('id') id: string,
    @Body() datos: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.productos.editar(id, datos, r.usuario!.id);
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'VENDEDOR')
  obtener(@Param('id') id: string) {
    return this.productos.obtener(id);
  }
}

import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ProductosService } from './productos.service.js';

@Controller('api/v1/productos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Post()
  crear(@Body() datos: unknown) {
    return this.productos.crear(datos);
  }

  @Get()
  listar(@Query() consulta: Record<string, unknown>) {
    return this.productos.listar(consulta);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.productos.obtener(id);
  }
}

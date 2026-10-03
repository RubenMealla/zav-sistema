import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ClientesService } from './clientes.service.js';

@Controller('api/v1/clientes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDEDOR')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Post()
  crear(@Body() datos: unknown) {
    return this.clientes.crear(datos);
  }

  @Get()
  listar(@Query() consulta: Record<string, unknown>) {
    return this.clientes.listar(consulta);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.clientes.obtener(id);
  }
}

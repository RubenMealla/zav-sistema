import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PedidosService } from './pedidos.service.js';

@Controller('api/v1/admin/pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class PedidosAdminController {
  constructor(private readonly pedidos: PedidosService) {}

  @Get()
  listar(@Query() consulta: Record<string, unknown>) {
    return this.pedidos.listarAdmin(consulta);
  }
}

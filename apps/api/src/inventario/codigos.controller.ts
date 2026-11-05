import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CodigosService } from './codigos.service.js';

@Controller('api/v1/codigos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class CodigosController {
  constructor(private readonly codigos: CodigosService) {}
  @Get('producto') producto(@Query() q: Record<string, unknown>) { return this.codigos.producto(q); }
  @Get('lote') lote(@Query() q: Record<string, unknown>) { return this.codigos.lote(q); }
}

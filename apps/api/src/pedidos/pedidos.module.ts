import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { UsuarioEntity } from '../database/entities/usuario.entity.js';
import { ClientesController } from './clientes.controller.js';
import { ClientesService } from './clientes.service.js';
import { PedidosController } from './pedidos.controller.js';
import { PedidosService } from './pedidos.service.js';
import { GeografiaController } from './geografia.controller.js';
import { GeografiaService } from './geografia.service.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UsuarioEntity])],
  controllers: [ClientesController, PedidosController, GeografiaController],
  providers: [ClientesService, PedidosService, GeografiaService],
})
export class PedidosModule {}

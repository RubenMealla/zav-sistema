import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClientesController } from './clientes.controller.js';
import { ClientesService } from './clientes.service.js';
import { PedidosController } from './pedidos.controller.js';
import { PedidosService } from './pedidos.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ClientesController, PedidosController],
  providers: [ClientesService, PedidosService],
})
export class PedidosModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { ProductoEntity } from '../database/entities/producto.entity.js';
import { LoteEntity } from '../database/entities/lote.entity.js';
import { UsuarioEntity } from '../database/entities/usuario.entity.js';
import { ProductosController } from './productos.controller.js';
import { ProductosService } from './productos.service.js';
import { LotesController } from './lotes.controller.js';
import { LotesService } from './lotes.service.js';
import { MovimientosController } from './movimientos.controller.js';
import { MovimientosService } from './movimientos.service.js';
import { CondicionesLoteController } from './condiciones-lote.controller.js';
import { CondicionesLoteService } from './condiciones-lote.service.js';
import { CodigosController } from './codigos.controller.js';
import { CodigosService } from './codigos.service.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([ProductoEntity, LoteEntity, UsuarioEntity])],
  controllers: [CodigosController, ProductosController, LotesController, MovimientosController, CondicionesLoteController],
  providers: [CodigosService, ProductosService, LotesService, MovimientosService, CondicionesLoteService],
})
export class InventarioModule {}

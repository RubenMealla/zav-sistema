import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { ProductoEntity } from '../database/entities/producto.entity.js';
import { LoteEntity } from '../database/entities/lote.entity.js';
import { UsuarioEntity } from '../database/entities/usuario.entity.js';
import { ProductosController } from './productos.controller.js';
import { ProductosService } from './productos.service.js';
import { LotesE3Controller } from './lotes-e3.controller.js';
import { LotesService } from './lotes-saldos.service.js';
import { MovimientosE3Controller } from './movimientos-e3.controller.js';
import { MovimientosService } from './movimientos-saldos.service.js';
import { CondicionesLoteController } from './condiciones-lote.controller.js';
import { CondicionesLoteService } from './condiciones-lote.service.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([ProductoEntity, LoteEntity, UsuarioEntity])],
  controllers: [
    ProductosController,
    LotesE3Controller,
    MovimientosE3Controller,
    CondicionesLoteController,
  ],
  providers: [
    ProductosService,
    LotesService,
    MovimientosService,
    CondicionesLoteService,
  ],
})
export class InventarioE3Module {}

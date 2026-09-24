import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { ProductoEntity } from '../database/entities/producto.entity.js';
import { LoteEntity } from '../database/entities/lote.entity.js';
import { ExistenciaEntity } from '../database/entities/existencia.entity.js';
import { UsuarioEntity } from '../database/entities/usuario.entity.js';
import { ProductosController } from './productos.controller.js';
import { ProductosService } from './productos.service.js';
import { LotesController } from './lotes.controller.js';
import { LotesService } from './lotes.service.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([ProductoEntity, LoteEntity, ExistenciaEntity, UsuarioEntity])],
  controllers: [ProductosController, LotesController],
  providers: [ProductosService, LotesService],
})
export class InventarioModule {}

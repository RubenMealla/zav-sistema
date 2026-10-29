import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { UsuarioEntity } from '../database/entities/usuario.entity.js';
import {
  CatalogoController,
  CatalogoPublicoController,
} from './catalogo.controller.js';
import { CatalogoService } from './catalogo.service.js';
import { ImagenesService } from './imagenes.service.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UsuarioEntity])],
  controllers: [CatalogoController, CatalogoPublicoController],
  providers: [CatalogoService, ImagenesService],
  exports: [CatalogoService],
})
export class CatalogoModule {}

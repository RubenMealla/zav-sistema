import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { UsuarioEntity } from '../database/entities/usuario.entity.js';
import { OperacionesController } from './operaciones.controller.js';
import { OperacionesService } from './operaciones.service.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UsuarioEntity])],
  controllers: [OperacionesController],
  providers: [OperacionesService],
})
export class OperacionesModule {}

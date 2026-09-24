import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { UsuarioEntity } from './database/entities/usuario.entity.js';
import { ProductoEntity } from './database/entities/producto.entity.js';
import { LoteEntity } from './database/entities/lote.entity.js';
import { UbicacionEntity } from './database/entities/ubicacion.entity.js';
import { ExistenciaEntity } from './database/entities/existencia.entity.js';
import { MovimientoEntity } from './database/entities/movimiento.entity.js';
import { AuthModule } from './auth/auth.module.js';
import { InventarioModule } from './inventario/inventario.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    InventarioModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('DATABASE_URL'),
        entities: [
          UsuarioEntity,
          ProductoEntity,
          LoteEntity,
          UbicacionEntity,
          ExistenciaEntity,
          MovimientoEntity,
        ],
        synchronize: false,
        migrationsRun: false,
        retryAttempts: 2,
        retryDelay: 1000,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

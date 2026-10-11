import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/v1/salud')
  async salud() {
    try {
      await this.dataSource.query('SELECT 1');
      return { estado: 'ok' };
    } catch {
      // No divulgar detalles de la conexión ni de PostgreSQL en una ruta pública.
      throw new ServiceUnavailableException('Servicio no disponible.');
    }
  }
}

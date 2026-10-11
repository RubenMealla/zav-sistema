import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;
  const query = vi.fn();

  beforeEach(async () => {
    query.mockReset();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DataSource, useValue: { query } }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('version', () => {
    it('expone la versión estable independiente del contrato y sin consultar la base', () => {
      expect(appController.version()).toEqual({
        servicio: 'ZAV API',
        version: '1.0.0',
        contrato: 'v1',
      });
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('salud', () => {
    it('confirma PostgreSQL antes de responder ok', async () => {
      query.mockResolvedValue([{ '?column?': 1 }]);
      await expect(appController.salud()).resolves.toEqual({ estado: 'ok' });
      expect(query).toHaveBeenCalledExactlyOnceWith('SELECT 1');
    });

    it('responde 503 sin exponer detalles si falla la base', async () => {
      query.mockRejectedValue(new Error('cadena de conexión confidencial'));
      await expect(appController.salud()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});

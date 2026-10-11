import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { RegistroHttpMiddleware } from './registro-http.middleware.js';

describe('RegistroHttpMiddleware', () => {
  it('registra ruta parametrizada, código y duración sin revelar URL ni credenciales', () => {
    const logger = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const respuesta = Object.assign(new EventEmitter(), { statusCode: 403 });
    const siguiente = vi.fn();

    const solicitud = {
      method: 'GET',
      originalUrl: '/api/v1/pedidos/identificador-privado?token=confidencial',
      headers: { authorization: 'Bearer clave-privada' },
      route: { path: '/api/v1/pedidos/:id' },
    };

    const middleware = new RegistroHttpMiddleware();
    middleware.use(
      solicitud as unknown as Request,
      respuesta as unknown as Response,
      siguiente as unknown as NextFunction,
    );

    expect(siguiente).toHaveBeenCalledOnce();
    respuesta.emit('finish');
    expect(logger).toHaveBeenCalledOnce();

    const contenido = String(logger.mock.calls[0]?.[0] ?? '');
    expect(contenido).toContain('"metodo":"GET"');
    expect(contenido).toContain('"ruta":"/api/v1/pedidos/:id"');
    expect(contenido).toContain('"estado_http":403');
    expect(contenido).toContain('"duracion_ms":');
    expect(contenido).not.toContain('identificador-privado');
    expect(contenido).not.toContain('confidencial');
    expect(contenido).not.toContain('clave-privada');

    logger.mockRestore();
  });
});

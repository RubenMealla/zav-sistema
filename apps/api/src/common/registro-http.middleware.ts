import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { performance } from 'node:perf_hooks';

/**
 * Registro técnico de la solicitud HTTP. Nunca almacena identificadores de
 * usuarios, parámetros, direcciones de cliente, cuerpos ni cabeceras.
 */
@Injectable()
export class RegistroHttpMiddleware implements NestMiddleware {
  private readonly logger = new Logger('SolicitudesHTTP');

  use(solicitud: Request, respuesta: Response, siguiente: NextFunction): void {
    const inicio = performance.now();
    respuesta.once('finish', () => {
      // Se utiliza la plantilla de ruta de Express (p. ej. :id),
      // no la URL recibida, que podría contener identificadores personales.
      const rutaConfigurada: unknown = solicitud.route?.path;
      const ruta = typeof rutaConfigurada === 'string' ? rutaConfigurada : '(sin_ruta)';
      const ms = Number((performance.now() - inicio).toFixed(2));
      this.logger.log(
        JSON.stringify({
          metodo: solicitud.method,
          ruta,
          estado_http: respuesta.statusCode,
          duracion_ms: ms,
        }),
      );
    });
    siguiente();
  }
}

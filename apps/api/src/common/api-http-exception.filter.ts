import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ApiHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const contexto = host.switchToHttp();
    const respuesta = contexto.getResponse<Response>();
    const solicitud = contexto.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: string | string[] = 'Ocurrio un error interno.';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const contenido = exception.getResponse();

      if (typeof contenido === 'string') {
        message = contenido;
      } else if (contenido && typeof contenido === 'object') {
        const datos = contenido as { message?: unknown; error?: unknown };
        if (typeof datos.message === 'string' || Array.isArray(datos.message)) {
          message = datos.message as string | string[];
        }
        if (typeof datos.error === 'string') {
          error = datos.error;
        } else {
          error = exception.name.replace(/Exception$/, '') || 'Http Error';
        }
      }
    }

    respuesta.status(statusCode).json({
      statusCode,
      error,
      message,
      path: solicitud.originalUrl ?? solicitud.url,
      timestamp: new Date().toISOString(),
    });
  }
}

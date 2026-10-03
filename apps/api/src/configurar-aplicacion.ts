import type { INestApplication } from '@nestjs/common';
import { ApiHttpExceptionFilter } from './common/api-http-exception.filter.js';

const ORIGENES_POR_DEFECTO = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://zav-sistema.vercel.app',
];

function origenesPermitidos(): Set<string> {
  const configurados = process.env.CORS_ORIGINS
    ?.split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);

  return new Set(configurados?.length ? configurados : ORIGENES_POR_DEFECTO);
}

export function configurarAplicacion(app: INestApplication) {
  const permitidos = origenesPermitidos();

  app.enableCors({
    origin(origen, callback) {
      if (!origen || permitidos.has(origen)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  app.useGlobalFilters(new ApiHttpExceptionFilter());
}

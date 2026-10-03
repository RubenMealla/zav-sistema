import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const ORIGENES_POR_DEFECTO = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://zav-sistema.vercel.app',
];

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const configurados = process.env.CORS_ORIGINS
      ?.split(',')
      .map((origen) => origen.trim())
      .filter(Boolean);
    const permitidos = new Set(configurados?.length ? configurados : ORIGENES_POR_DEFECTO);
    const origen = req.headers.origin;

    if (origen && permitidos.has(origen)) {
      res.setHeader('Access-Control-Allow-Origin', origen);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  }
}

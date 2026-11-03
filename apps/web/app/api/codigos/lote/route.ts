import { consultarCodigo } from '../consultar';

export function GET(req: Request) { return consultarCodigo(req, 'lote'); }

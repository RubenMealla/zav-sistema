import { cookies } from 'next/headers';

const API = process.env.API_BASE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://zav-api-2026.onrender.com' : 'http://localhost:3001');

type Producto = { codigo: string };
type Pagina = { items: Producto[]; total: number; page?: number; limit?: number };

const PREFIJOS: Record<string, string> = {
  MORTADELAS: 'MTD',
  CHORIZOS: 'CHO',
  SALCHICHAS: 'SAL',
  MORCILLAS: 'MRC',
  JAMONES: 'JAM',
  'TOCINOS Y AHUMADOS': 'TOA',
  'FIAMBRES ESPECIALES': 'FES',
};

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

function prefijoFamilia(familia: string) {
  const normalizada = normalizar(familia);
  if (PREFIJOS[normalizada]) return PREFIJOS[normalizada];
  const ignorar = new Set(['Y', 'DE', 'DEL', 'LA', 'LAS', 'LOS']);
  const palabras = normalizada.split(/[^A-Z0-9]+/).filter((p) => p && !ignorar.has(p));
  if (!palabras.length) return 'PRD';
  if (palabras.length === 1) return palabras[0].slice(0, 3).padEnd(3, 'X');
  let sigla = palabras.map((p) => p[0]).join('').slice(0, 3);
  if (sigla.length < 3) sigla = (sigla + palabras.join('')).slice(0, 3);
  return sigla.padEnd(3, 'X');
}

async function listarProductos(token: string) {
  const acumulados: Producto[] = [];
  let pagina = 1;
  const limite = 100;
  for (;;) {
    const respuesta = await fetch(`${API}/api/v1/productos?page=${pagina}&limit=${limite}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!respuesta.ok) return { estado: respuesta.status, items: [] as Producto[] };
    const datos = await respuesta.json() as Pagina;
    acumulados.push(...(datos.items ?? []));
    if (acumulados.length >= datos.total || datos.items.length < limite || pagina >= 50) break;
    pagina += 1;
  }
  return { estado: 200, items: acumulados };
}

export async function GET(solicitud: Request) {
  const token = (await cookies()).get('zav_acceso')?.value;
  if (!token) return Response.json({ message: 'Sesión requerida.' }, { status: 401 });
  const familia = new URL(solicitud.url).searchParams.get('familia')?.trim() ?? '';
  if (familia.length < 2 || familia.length > 70) return Response.json({ message: 'Familia inválida.' }, { status: 400 });

  try {
    const prefijo = prefijoFamilia(familia);
    const productos = await listarProductos(token);
    if (productos.estado !== 200) return Response.json({ message: 'No se pudo consultar productos.' }, { status: productos.estado });

    const patron = new RegExp(`^${prefijo}-(\\d+)$`);
    let mayor = 0;
    for (const producto of productos.items) {
      const coincidencia = producto.codigo.toUpperCase().match(patron);
      if (coincidencia) mayor = Math.max(mayor, Number(coincidencia[1]) || 0);
    }

    return Response.json({
      codigo: `${prefijo}-${String(mayor + 1).padStart(3, '0')}`,
      prefijo,
      convencion: 'interna',
    });
  } catch {
    return Response.json({ message: 'No se pudo calcular el siguiente código.' }, { status: 503 });
  }
}

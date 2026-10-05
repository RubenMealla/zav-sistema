import { cookies } from 'next/headers';

const API = process.env.API_BASE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://zav-api-2026.onrender.com' : 'http://localhost:3001');

type Producto = { id: string; codigo: string };
type Lote = { codigo: string };
type Pagina = { items: Lote[]; total: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

async function listarLotes(token: string, productoId: string) {
  const acumulados: Lote[] = [];
  let pagina = 1;
  const limite = 100;
  for (;;) {
    const respuesta = await fetch(`${API}/api/v1/lotes?productoId=${encodeURIComponent(productoId)}&page=${pagina}&limit=${limite}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!respuesta.ok) return { estado: respuesta.status, items: [] as Lote[] };
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

  const parametros = new URL(solicitud.url).searchParams;
  const productoId = parametros.get('productoId') ?? '';
  const elaboradoEl = parametros.get('elaboradoEl') ?? '';
  if (!UUID.test(productoId) || !FECHA.test(elaboradoEl)) {
    return Response.json({ message: 'Producto o fecha inválidos.' }, { status: 400 });
  }

  try {
    const respuestaProducto = await fetch(`${API}/api/v1/productos/${encodeURIComponent(productoId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!respuestaProducto.ok) {
      return Response.json({ message: 'No se pudo consultar el producto.' }, { status: respuestaProducto.status });
    }
    const producto = await respuestaProducto.json() as Producto;

    const lotes = await listarLotes(token, productoId);
    if (lotes.estado !== 200) {
      return Response.json({ message: 'No se pudo consultar lotes.' }, { status: lotes.estado });
    }

    const fechaCompacta = elaboradoEl.replaceAll('-', '');
    const base = `TJ-ZAV-${producto.codigo.toUpperCase()}-${fechaCompacta}`;
    const inicio = `${base}-`;
    let mayor = 0;

    for (const lote of lotes.items) {
      const codigo = lote.codigo.toUpperCase();
      if (!codigo.startsWith(inicio)) continue;
      const sufijo = codigo.slice(inicio.length);
      if (/^\d+$/.test(sufijo)) mayor = Math.max(mayor, Number(sufijo) || 0);
    }

    return Response.json({
      codigo: `${base}-${String(mayor + 1).padStart(2, '0')}`,
      convencion: 'interna-editable',
    });
  } catch {
    return Response.json({ message: 'No se pudo calcular el siguiente código de lote.' }, { status: 503 });
  }
}

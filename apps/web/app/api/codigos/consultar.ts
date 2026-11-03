import { cookies } from 'next/headers';
import { API_BASE_URL } from '../../lib/api-servidor';

export async function consultarCodigo(req: Request, tipo: 'producto' | 'lote') {
  const token = (await cookies()).get('zav_acceso')?.value;
  if (!token) return Response.json({ message: 'La sesión venció. Vuelve a ingresar.' }, { status: 401 });
  try {
    const respuesta = await fetch(`${API_BASE_URL}/api/v1/codigos/${tipo}${new URL(req.url).search}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    return new Response(await respuesta.text(), { status: respuesta.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ message: 'No se pudo sugerir el código. Reintenta o introduce el de la etiqueta.' }, { status: 503 });
  }
}

import { cookies } from 'next/headers';

const API = process.env.API_BASE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://zav-api-2026.onrender.com' : 'http://localhost:3001');

export async function GET(solicitud: Request) {
  const token = (await cookies()).get('zav_acceso')?.value;
  if (!token) return Response.json({ message: 'Sesión requerida.' }, { status: 401 });

  const q = new URL(solicitud.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2 || q.length > 200) {
    return Response.json({ message: 'La búsqueda debe contener entre 2 y 200 caracteres.' }, { status: 400 });
  }

  try {
    const respuesta = await fetch(`${API}/api/v1/geografia/autocompletar?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const contenido = await respuesta.text();
    return new Response(contenido, {
      status: respuesta.status,
      headers: { 'content-type': respuesta.headers.get('content-type') ?? 'application/json; charset=utf-8' },
    });
  } catch {
    return Response.json({ message: 'No se pudo conectar con el servicio de geografía.' }, { status: 503 });
  }
}

const API = process.env.API_BASE_URL ?? 'https://zav-api-2026.onrender.com';

type ContextoRuta = { params: Promise<{ ruta: string[] }> };

async function reenviar(solicitud: Request, contexto: ContextoRuta) {
  const { ruta } = await contexto.params;
  if (!ruta?.length || ruta[0] !== 'api' || ruta[1] !== 'v1') {
    return Response.json({ message: 'Ruta Swagger no permitida.' }, { status: 404 });
  }

  const entrada = new URL(solicitud.url);
  const destino = new URL('/' + ruta.map(encodeURIComponent).join('/'), API);
  destino.search = entrada.search;

  const headers = new Headers();
  const authorization = solicitud.headers.get('authorization');
  const contentType = solicitud.headers.get('content-type');
  if (authorization) headers.set('authorization', authorization);
  if (contentType) headers.set('content-type', contentType);
  headers.set('accept', solicitud.headers.get('accept') ?? 'application/json');

  const permiteCuerpo = !['GET', 'HEAD'].includes(solicitud.method);
  const respuesta = await fetch(destino, {
    method: solicitud.method,
    headers,
    body: permiteCuerpo ? await solicitud.text() : undefined,
    cache: 'no-store',
    redirect: 'manual',
  });

  const salidaHeaders = new Headers();
  salidaHeaders.set('content-type', respuesta.headers.get('content-type') ?? 'application/json; charset=utf-8');
  salidaHeaders.set('cache-control', 'no-store');

  return new Response(await respuesta.arrayBuffer(), {
    status: respuesta.status,
    headers: salidaHeaders,
  });
}

export const GET = reenviar;
export const POST = reenviar;
export const PATCH = reenviar;
export const PUT = reenviar;
export const DELETE = reenviar;
export const OPTIONS = reenviar;

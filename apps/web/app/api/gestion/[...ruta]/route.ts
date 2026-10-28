import { cookies } from "next/headers";
import { API_BASE_URL } from "../../../lib/api-servidor";

async function reenviar(
  req: Request,
  ctx: { params: Promise<{ ruta: string[] }> },
) {
  const { ruta } = await ctx.params;
  if (
    !ruta?.length ||
    !["catalogo", "operaciones"].includes(ruta[0]) ||
    ruta.some((s) => !/^[a-zA-Z0-9-]+$/.test(s))
  )
    return Response.json({ message: "Ruta no permitida." }, { status: 404 });
  const token = (await cookies()).get("zav_acceso")?.value;
  if (!token)
    return Response.json(
      { message: "La sesión venció. Vuelve a ingresar." },
      { status: 401 },
    );
  // Host es el destino solicitado por el navegador; req.url puede contener el
  // hostname interno de Next detrás de un proxy. No confiar en X-Forwarded-Host.
  if (req.method !== "GET") {
    let origen: URL;
    try {
      origen = new URL(req.headers.get("origin") ?? "");
    } catch {
      return Response.json(
        { message: "Origen no permitido." },
        { status: 403 },
      );
    }
    if (
      !["https:", "http:"].includes(origen.protocol) ||
      origen.host !== req.headers.get("host") ||
      req.headers.get("sec-fetch-site") === "cross-site"
    )
      return Response.json(
        { message: "Origen no permitido." },
        { status: 403 },
      );
  }
  const longitud = Number(req.headers.get("content-length") ?? 0);
  if (longitud > 6 * 1024 * 1024)
    return Response.json(
      { message: "El archivo supera el máximo permitido." },
      { status: 413 },
    );
  try {
    let cuerpo: Uint8Array<ArrayBuffer> | undefined;
    if (req.method !== "GET" && req.body) {
      const lector = req.body.getReader(),
        partes: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await lector.read();
        if (done) break;
        total += value.byteLength;
        if (total > 6 * 1024 * 1024) {
          await lector.cancel();
          return Response.json(
            { message: "El archivo supera el máximo permitido." },
            { status: 413 },
          );
        }
        partes.push(value);
      }
      cuerpo = new Uint8Array(total);
      let offset = 0;
      for (const parte of partes) {
        cuerpo.set(parte, offset);
        offset += parte.byteLength;
      }
    }
    const respuesta = await fetch(
      `${API_BASE_URL}/api/v1/${ruta.map(encodeURIComponent).join("/")}${new URL(req.url).search}`,
      {
        method: req.method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(req.headers.get("content-type")
            ? { "Content-Type": req.headers.get("content-type")! }
            : {}),
        },
        body: cuerpo,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      },
    );
    return new Response(await respuesta.arrayBuffer(), {
      status: respuesta.status,
      headers: {
        "Content-Type":
          respuesta.headers.get("content-type") ?? "application/json",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      {
        message:
          "No se recibió confirmación de la API. Verifica o reintenta la misma operación.",
      },
      { status: 502 },
    );
  }
}
export const GET = reenviar;
export const POST = reenviar;
export const PATCH = reenviar;

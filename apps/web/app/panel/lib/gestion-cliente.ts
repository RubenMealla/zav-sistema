export class ErrorGestion extends Error {
  constructor(
    message: string,
    public estado: number,
  ) {
    super(message);
  }
}
export async function gestion<T>(
  ruta: string,
  metodo = "GET",
  datos?: unknown,
): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api/gestion/${ruta}`, {
      method: metodo,
      headers:
        datos instanceof FormData
          ? {}
          : datos === undefined
            ? {}
            : { "Content-Type": "application/json" },
      body:
        datos instanceof FormData
          ? datos
          : datos === undefined
            ? undefined
            : JSON.stringify(datos),
      cache: "no-store",
    });
  } catch {
    throw new ErrorGestion(
      "Sin confirmación del servidor. Verifica la conexión y reintenta la misma operación.",
      0,
    );
  }
  const body = await respuesta
    .json()
    .catch(() => ({ message: "Respuesta no válida del servidor." }));
  if (!respuesta.ok)
    throw new ErrorGestion(
      Array.isArray(body.message)
        ? body.message.join(" ")
        : (body.message ?? `HTTP ${respuesta.status}`),
      respuesta.status,
    );
  return body as T;
}
export async function todasLasPaginas<T>(ruta: string) {
  const items: T[] = [];
  let page = 1;
  while (true) {
    const r = await gestion<{ items: T[]; total: number }>(
      `${ruta}${ruta.includes("?") ? "&" : "?"}limit=100&page=${page}`,
    );
    items.push(...r.items);
    if (items.length >= r.total || r.items.length === 0) return items;
    page++;
  }
}
export const mensajeError = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la operación.";

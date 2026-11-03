import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useSesionGestion() {
  const router = useRouter();
  useEffect(() => {
    let redirigiendo = false;
    const entrar = () => {
      if (redirigiendo) return;
      redirigiendo = true;
      router.replace("/acceso?error=sesion");
    };
    window.addEventListener("zav-sesion-vencida", entrar);
    return () => window.removeEventListener("zav-sesion-vencida", entrar);
  }, [router]);
}

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
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new ErrorGestion(
      "Sin confirmación del servidor. Verifica la conexión y reintenta la misma operación.",
      0,
    );
  }
  if (respuesta.status === 401) {
    window.dispatchEvent(new Event("zav-sesion-vencida"));
    throw new ErrorGestion("Tu sesión terminó. Vuelve a ingresar para continuar.", 401);
  }
  const body = await respuesta.json().catch(() => {
    throw new ErrorGestion("Respuesta incompleta del servidor. Verifica o reintenta la misma operación.", respuesta.ok ? 502 : respuesta.status);
  });
  if (!body || typeof body !== "object")
    throw new ErrorGestion("Respuesta no válida del servidor. Verifica o reintenta la misma operación.", 502);
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

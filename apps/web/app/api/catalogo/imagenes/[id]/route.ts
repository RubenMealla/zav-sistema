import { API_BASE_URL } from "../../../../lib/api-servidor";
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  try {
    const r = await fetch(
      `${API_BASE_URL}/api/v1/publico/catalogo/imagenes/${id}`,
      { cache: "no-store", signal: AbortSignal.timeout(15000) },
    );
    return new Response(r.ok ? await r.arrayBuffer() : null, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") ?? "image/png",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}

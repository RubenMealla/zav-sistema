import Link from 'next/link';

export function Paginacion({ pagina, total, limite, parametro, parametros }: {
  pagina: number; total: number; limite: number; parametro: string;
  parametros: Record<string, string | undefined>;
}) {
  const paginas = Math.max(1, Math.ceil(total / limite));
  if (paginas <= 1) return null;
  const href = (destino: number) => {
    const query = new URLSearchParams();
    for (const [clave, valor] of Object.entries(parametros)) if (valor) query.set(clave, valor);
    if (destino > 1) query.set(parametro, String(destino)); else query.delete(parametro);
    return '/panel?' + query.toString();
  };
  const inicio = total === 0 ? 0 : (pagina - 1) * limite + 1;
  const fin = Math.min(total, pagina * limite);
  return (
    <nav className="paginacion" aria-label="Paginación de resultados">
      <span className="paginacion-resumen">{inicio}–{fin} de {total}</span>
      <div className="paginacion-controles">
        {pagina > 1 ? <Link className="boton boton-secundario" href={href(pagina - 1)}>Anterior</Link> : <span className="boton boton-secundario deshabilitado" aria-disabled="true">Anterior</span>}
        <span className="paginacion-actual">Página <strong>{pagina}</strong> de {paginas}</span>
        {pagina < paginas ? <Link className="boton boton-secundario" href={href(pagina + 1)}>Siguiente</Link> : <span className="boton boton-secundario deshabilitado" aria-disabled="true">Siguiente</span>}
      </div>
    </nav>
  );
}

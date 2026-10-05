import Link from 'next/link';

function rangoPaginas(actual: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, indice) => indice + 1);
  const paginas = new Set([1, total, actual - 1, actual, actual + 1].filter((pagina) => pagina >= 1 && pagina <= total));
  const ordenadas = [...paginas].sort((a, b) => a - b);
  const resultado: Array<number | '…'> = [];
  ordenadas.forEach((pagina, indice) => {
    const anterior = ordenadas[indice - 1];
    if (anterior && pagina - anterior > 1) resultado.push('…');
    resultado.push(pagina);
  });
  return resultado;
}

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
        <div className="paginacion-numeros" aria-label={`Página ${pagina} de ${paginas}`}>
          {rangoPaginas(pagina, paginas).map((item, indice) => item === '…'
            ? <span className="paginacion-elipsis" key={`elipsis-${indice}`} aria-hidden="true">…</span>
            : <Link key={item} href={href(item)} className={item === pagina ? 'paginacion-numero activo' : 'paginacion-numero'} aria-current={item === pagina ? 'page' : undefined} aria-label={`Página ${item}`}>{item}</Link>)}
        </div>
        {pagina < paginas ? <Link className="boton boton-secundario" href={href(pagina + 1)}>Siguiente</Link> : <span className="boton boton-secundario deshabilitado" aria-disabled="true">Siguiente</span>}
      </div>
    </nav>
  );
}

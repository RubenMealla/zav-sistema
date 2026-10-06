'use client';
import Link from 'next/link';
const LIMITES=[10,20,30,50,100,150];
function rangoPaginas(actual:number,total:number):Array<number|'…'>{if(total<=7)return Array.from({length:total},(_,i)=>i+1);const p=new Set([1,total,actual-1,actual,actual+1].filter(x=>x>=1&&x<=total));const o=[...p].sort((a,b)=>a-b);const r:Array<number|'…'>=[];o.forEach((x,i)=>{const a=o[i-1];if(a&&x-a>1)r.push('…');r.push(x)});return r}
export function Paginacion({pagina,total,limite,parametro,parametros}:{pagina:number;total:number;limite:number;parametro:string;parametros:Record<string,string|undefined>}){
 const paginas=Math.max(1,Math.ceil(total/limite));const inicio=total===0?0:(pagina-1)*limite+1;const fin=Math.min(total,pagina*limite);
 const href=(destino:number)=>{const q=new URLSearchParams();for(const[c,v]of Object.entries(parametros))if(v)q.set(c,v);q.set('limite',String(limite));if(destino>1)q.set(parametro,String(destino));return '/panel?'+q.toString()};
 return <nav className="paginacion" aria-label="Paginación de resultados">
  <div className="paginacion-info"><span className="paginacion-resumen">Mostrando <strong>{inicio}–{fin}</strong> de <strong>{total}</strong> registros</span>
   <form method="get" className="paginacion-tamano">{Object.entries(parametros).map(([c,v])=>v?<input key={c} type="hidden" name={c} value={v}/>:null)}<label htmlFor={'limite-'+parametro}>Filas</label><select id={'limite-'+parametro} name="limite" defaultValue={String(limite)} onChange={e=>e.currentTarget.form?.requestSubmit()}>{LIMITES.map(n=><option key={n} value={n}>{n}</option>)}</select></form>
  </div>
  <div className="paginacion-controles">{pagina>1?<Link className="boton boton-secundario" href={href(pagina-1)}>Anterior</Link>:<span className="boton boton-secundario deshabilitado" aria-disabled="true">Anterior</span>}
   <div className="paginacion-numeros" aria-label={'Página '+pagina+' de '+paginas}>{rangoPaginas(pagina,paginas).map((x,i)=>x==='…'?<span className="paginacion-elipsis" key={'e'+i}>…</span>:<Link key={x} href={href(x)} className={x===pagina?'paginacion-numero activo':'paginacion-numero'} aria-current={x===pagina?'page':undefined}>{x}</Link>)}</div>
   {pagina<paginas?<Link className="boton boton-secundario" href={href(pagina+1)}>Siguiente</Link>:<span className="boton boton-secundario deshabilitado" aria-disabled="true">Siguiente</span>}
  </div>
 </nav>
}
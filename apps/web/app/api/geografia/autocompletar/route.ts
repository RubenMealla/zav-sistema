import { cookies } from 'next/headers';

const API = process.env.API_BASE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://zav-api-2026.onrender.com' : 'http://localhost:3001');
type Resultado = { direccion:string; principal:string; secundaria:string; tipo:string; departamento:string|null; ciudad:string|null; paisCodigo:string; latitud:number; longitud:number };
type EstadoPhoton = { disponible:boolean; resultados:Resultado[] };
function texto(valor:unknown){return typeof valor==='string'?valor.trim():''}

async function consultaPhoton(q:string):Promise<EstadoPhoton>{
  const url=new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q',q); url.searchParams.set('lang','es'); url.searchParams.set('limit','20');
  url.searchParams.set('lat','-21.535486'); url.searchParams.set('lon','-64.729557');
  try{
    const respuesta=await fetch(url,{headers:{Accept:'application/json','User-Agent':'ZAV-Sistema/2026'},cache:'no-store',signal:AbortSignal.timeout(6500)});
    if(!respuesta.ok)return{disponible:false,resultados:[]};
    const cuerpo=await respuesta.json() as {features?:Array<{geometry?:{coordinates?:unknown[]};properties?:Record<string,unknown>}>};
    const resultados=(cuerpo.features??[]).map((f)=>{
      const p=f.properties??{},c=f.geometry?.coordinates??[]; const longitud=Number(c[0]),latitud=Number(c[1]);
      const estado=texto(p.state),ciudad=texto(p.city),county=texto(p.county),distrito=texto(p.district),localidad=texto(p.locality),nombre=texto(p.name),calle=texto(p.street),paisCodigo=texto(p.countrycode).toLowerCase();
      const contexto=[estado,ciudad,county,distrito,localidad,nombre,calle].join(' ').toLocaleLowerCase('es-BO');
      if(paisCodigo!=='bo'||!contexto.includes('tarija')||!Number.isFinite(latitud)||!Number.isFinite(longitud))return null;
      const principal=nombre||calle||localidad||ciudad||distrito;
      const secundaria=[calle,localidad,distrito,ciudad,county,estado].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
      if(!principal)return null;
      return {direccion:[principal,secundaria].filter(Boolean).join(', '),principal,secundaria,tipo:texto(p.type)||'place',departamento:estado||null,ciudad:ciudad||localidad||null,paisCodigo,latitud,longitud};
    }).filter((x):x is Resultado=>x!==null);
    return{disponible:true,resultados};
  }catch{return{disponible:false,resultados:[]}}
}

async function photon(q:string):Promise<EstadoPhoton>{
  const [contextual,general]=await Promise.all([consultaPhoton(q+', Tarija, Bolivia'),consultaPhoton(q)]);
  const mapa=new Map<string,Resultado>();
  for(const r of [...contextual.resultados,...general.resultados]){
    const clave=`${r.latitud.toFixed(5)}:${r.longitud.toFixed(5)}:${r.direccion.toLocaleLowerCase('es-BO')}`;
    if(!mapa.has(clave))mapa.set(clave,r);
  }
  return{disponible:contextual.disponible||general.disponible,resultados:[...mapa.values()].slice(0,10)};
}

export async function GET(solicitud: Request) {
  const token=(await cookies()).get('zav_acceso')?.value;
  if(!token)return Response.json({message:'Sesión requerida.'},{status:401});
  const q=new URL(solicitud.url).searchParams.get('q')?.trim()??'';
  if(q.length<1||q.length>200)return Response.json({message:'La búsqueda debe contener entre 1 y 200 caracteres.'},{status:400});
  try{
    const respuesta=await fetch(`${API}/api/v1/geografia/autocompletar?q=${encodeURIComponent(q)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(6500)});
    if(respuesta.ok){
      const datos=await respuesta.json() as {resultados?:Resultado[]};
      if(Array.isArray(datos.resultados)&&datos.resultados.length)return Response.json({resultados:datos.resultados.slice(0,10)});
    }
  }catch{}
  const alternativos=await photon(q);
  if(alternativos.resultados.length)return Response.json({resultados:alternativos.resultados});
  if(alternativos.disponible)return Response.json({resultados:[]});
  return Response.json({message:'El servicio de búsqueda de direcciones no está disponible en este momento.'},{status:503});
}

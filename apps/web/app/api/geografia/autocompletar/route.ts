import { cookies } from 'next/headers';

const API = process.env.API_BASE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://zav-api-2026.onrender.com' : 'http://localhost:3001');
const VIEWBOX_TARIJA = '-65.333333,-20.833333,-62.250000,-22.833333';
type Resultado = { direccion:string; principal:string; secundaria:string; tipo:string; departamento:string|null; ciudad:string|null; paisCodigo:string; latitud:number; longitud:number };
type EstadoProveedor = { disponible:boolean; resultados:Resultado[] };
type Nominatim = { lat?:string; lon?:string; display_name?:string; type?:string; address?:Record<string,string|undefined> };
function texto(valor:unknown){return typeof valor==='string'?valor.trim():''}
function unico(resultados:Resultado[]){
  const mapa=new Map<string,Resultado>();
  for(const r of resultados){
    const clave=`${r.latitud.toFixed(5)}:${r.longitud.toFixed(5)}:${r.direccion.toLocaleLowerCase('es-BO')}`;
    if(!mapa.has(clave))mapa.set(clave,r);
  }
  return [...mapa.values()].slice(0,10);
}
function esTarija(departamento:string, direccion:string){
  return `${departamento} ${direccion}`.toLocaleLowerCase('es-BO').includes('tarija');
}

async function nominatim(q:string):Promise<EstadoProveedor>{
  const url=new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q',q);
  url.searchParams.set('format','jsonv2');
  url.searchParams.set('addressdetails','1');
  url.searchParams.set('limit','10');
  url.searchParams.set('countrycodes','bo');
  url.searchParams.set('accept-language','es');
  url.searchParams.set('viewbox',VIEWBOX_TARIJA);
  url.searchParams.set('bounded','1');
  try{
    const respuesta=await fetch(url,{
      headers:{Accept:'application/json','User-Agent':'ZAV-Sistema/2026'},
      cache:'no-store',
      signal:AbortSignal.timeout(6500),
    });
    if(!respuesta.ok)return{disponible:false,resultados:[]};
    const cuerpo=await respuesta.json() as Nominatim[];
    const resultados=cuerpo.map((r)=>{
      const latitud=Number(r.lat),longitud=Number(r.lon),a=r.address??{};
      const paisCodigo=texto(a.country_code).toLowerCase();
      const departamento=texto(a.state)||texto(a.region);
      const ciudad=texto(a.city)||texto(a.town)||texto(a.village)||texto(a.municipality)||texto(a.county);
      const barrio=texto(a.suburb)||texto(a.neighbourhood)||texto(a.quarter);
      const via=texto(a.road)||texto(a.pedestrian)||texto(a.path);
      const nombre=texto(a.amenity)||texto(a.shop)||texto(a.building)||texto(a.tourism)||barrio||via||ciudad;
      const direccion=texto(r.display_name);
      if(paisCodigo!=='bo'||!esTarija(departamento,direccion)||!Number.isFinite(latitud)||!Number.isFinite(longitud)||!direccion)return null;
      const principal=nombre||direccion.split(',')[0];
      const secundaria=[via,barrio,ciudad,departamento].filter(Boolean).filter((v,i,a2)=>a2.indexOf(v)===i).join(', ');
      return{direccion,principal,secundaria,tipo:texto(r.type)||'place',departamento:departamento||null,ciudad:ciudad||null,paisCodigo,latitud,longitud};
    }).filter((x):x is Resultado=>x!==null);
    return{disponible:true,resultados:unico(resultados)};
  }catch{return{disponible:false,resultados:[]}}
}

async function consultaPhoton(q:string):Promise<EstadoProveedor>{
  const url=new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q',q+', Tarija, Bolivia');
  url.searchParams.set('lang','es');
  url.searchParams.set('limit','12');
  url.searchParams.set('lat','-21.535486');
  url.searchParams.set('lon','-64.729557');
  try{
    const respuesta=await fetch(url,{headers:{Accept:'application/json','User-Agent':'ZAV-Sistema/2026'},cache:'no-store',signal:AbortSignal.timeout(6500)});
    if(!respuesta.ok)return{disponible:false,resultados:[]};
    const cuerpo=await respuesta.json() as {features?:Array<{geometry?:{coordinates?:unknown[]};properties?:Record<string,unknown>}>};
    const resultados=(cuerpo.features??[]).map((f)=>{
      const p=f.properties??{},c=f.geometry?.coordinates??[]; const longitud=Number(c[0]),latitud=Number(c[1]);
      const estado=texto(p.state),ciudad=texto(p.city),county=texto(p.county),distrito=texto(p.district),localidad=texto(p.locality),nombre=texto(p.name),calle=texto(p.street),paisCodigo=texto(p.countrycode).toLowerCase();
      const direccion=[nombre,calle,localidad,distrito,ciudad,county,estado].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
      if(paisCodigo!=='bo'||!esTarija(estado,direccion)||!Number.isFinite(latitud)||!Number.isFinite(longitud))return null;
      const principal=nombre||calle||localidad||ciudad||distrito;
      const secundaria=[calle,localidad,distrito,ciudad,county,estado].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
      if(!principal)return null;
      return {direccion,principal,secundaria,tipo:texto(p.type)||'place',departamento:estado||null,ciudad:ciudad||localidad||null,paisCodigo,latitud,longitud};
    }).filter((x):x is Resultado=>x!==null);
    return{disponible:true,resultados:unico(resultados)};
  }catch{return{disponible:false,resultados:[]}}
}

export async function GET(solicitud: Request) {
  const token=(await cookies()).get('zav_acceso')?.value;
  if(!token)return Response.json({message:'Sesión requerida.'},{status:401});
  const q=new URL(solicitud.url).searchParams.get('q')?.trim()??'';
  if(q.length<1||q.length>200)return Response.json({message:'La búsqueda debe contener entre 1 y 200 caracteres.'},{status:400});

  try{
    const respuesta=await fetch(`${API}/api/v1/geografia/autocompletar?q=${encodeURIComponent(q)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(5500)});
    if(respuesta.ok){
      const datos=await respuesta.json() as {resultados?:Resultado[]};
      if(Array.isArray(datos.resultados)&&datos.resultados.length)return Response.json({resultados:unico(datos.resultados),fuente:'api'});
    }
  }catch{}

  const osm=await nominatim(q);
  if(osm.resultados.length)return Response.json({resultados:osm.resultados,fuente:'osm'});

  const alternativos=await consultaPhoton(q);
  if(alternativos.resultados.length)return Response.json({resultados:alternativos.resultados,fuente:'photon'});

  if(osm.disponible||alternativos.disponible)return Response.json({resultados:[],fuente:'sin_coincidencias'});
  return Response.json({message:'El servicio de búsqueda de direcciones no está disponible en este momento.'},{status:503});
}

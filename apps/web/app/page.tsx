import { LandingPublica } from './componentes/landing-publica';
import { API_BASE_URL } from './lib/api-servidor';
import { imagenPublica,type FamiliaPublica } from './lib/catalogo-publico';

export const dynamic='force-dynamic';
export default async function Inicio() {
  let familias:FamiliaPublica[]=[];let error=false;
  try {
    const r=await fetch(`${API_BASE_URL}/api/v1/publico/catalogo`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!r.ok) throw new Error('Catálogo no disponible');
    const datos=await r.json() as {familias:FamiliaPublica[]};
    familias=datos.familias.map(f=>({...f,imagen:imagenPublica(f.imagen),productos:f.productos.map(p=>({...p,imagen:imagenPublica(p.imagen)}))}));
  }catch{error=true;}
  return <LandingPublica catalogo={familias} errorCatalogo={error}/>;
}

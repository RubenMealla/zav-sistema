import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
const API='https://zav-api-2026.onrender.com';
const user=process.env.ZAV_T5_ADMIN_IDENTIFICADOR;
const password=process.env.ZAV_T5_ADMIN_CONTRASENA;
if(!user||!password) throw new Error('Faltan credenciales de ejecución de solo lectura.');
const login=await fetch(API+'/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identificador:user,contrasena:password}),signal:AbortSignal.timeout(30000)});
if(!login.ok) throw new Error('Autenticación HTTP '+login.status);
const {accessToken}=await login.json();
if(typeof accessToken!=='string') throw new Error('No se obtuvo sesión.');
const samples=[];let observed=null;
for(let i=0;i<27;i++){
 const start=performance.now();
 const response=await fetch(API+'/api/v1/admin/pedidos?limit=10&page=1',{headers:{authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(30000),cache:'no-store'});
 const data=await response.json();
 if(response.status!==200||!Array.isArray(data.items)||typeof data.total!=='number') throw new Error('Consulta inválida '+response.status);
 observed=data.total;
 if(i>=2) samples.push(Number((performance.now()-start).toFixed(3)));
}
const sorted=[...samples].sort((a,b)=>a-b);
const result={fecha_utc:new Date().toISOString(),metodo:'GET',ruta:'/api/v1/admin/pedidos?limit=10&page=1',entorno:'API publicada desde GitHub Actions',operacion:'lectura',registros_observados:observed,muestras:samples.length,calentamientos:2,concurrencia:1,unidad:'ms',min:sorted[0],mediana:sorted[12],p95:sorted[Math.ceil(.95*sorted.length)-1],max:sorted[24],muestras_ms:samples,limitacion:'No mide pantalla, carga sostenida ni SLA'};
await mkdir('evidencia-rnf01',{recursive:true});
await writeFile('evidencia-rnf01/rendimiento-produccion-pedidos.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({muestras:result.muestras,p95:result.p95,mediana:result.mediana,registros:observed}));

import './soporte.mjs';
import assert from 'node:assert/strict';
import {afterEach,test} from 'node:test';
process.env.EXPO_PUBLIC_BUILD_CHANNEL='qa';
process.env.EXPO_PUBLIC_API_BASE_URL='http://10.0.2.2:3001';
const {leerOperacionPendiente,ejecutarOperacionPersistida}=await import('../src/lib/operacion-pendiente.ts');
const {configurarDireccionApi}=await import('../src/lib/configuracion-api.ts');
const {capturarUbicacionPuntual}=await import('../src/lib/ubicacion-puntual.ts');
const fetchOriginal=globalThis.fetch;
afterEach(()=>{globalThis.fetch=fetchOriginal;});
const operacion=()=>({version:1,ruta:'operaciones/salidas-directas',datos:{operacionClave:crypto.randomUUID(),detalles:[{productoId:crypto.randomUUID(),cantidad:3}],latitud:-21.53,longitud:-64.73,precisionMetros:5},resumen:'3 paquetes QA'});
test('fallo de red conserva solicitud y clave; reintentar recupera confirmación sin duplicar',async()=>{
  const usuario=crypto.randomUUID(),p=operacion();const peticiones=[];
  globalThis.fetch=async(_url,opts)=>{peticiones.push(JSON.parse(opts.body));throw new Error('Red cortada');};
  await assert.rejects(ejecutarOperacionPersistida(usuario,'token-qa',p),e=>e.status===0);
  assert.deepEqual(await leerOperacionPendiente(usuario),p);
  await assert.rejects(ejecutarOperacionPersistida(usuario,'token-qa',operacion()),/pendiente/);
  globalThis.fetch=async(_url,opts)=>{peticiones.push(JSON.parse(opts.body));return Response.json({id:'confirmacion-original'});};
  assert.equal((await ejecutarOperacionPersistida(usuario,'token-qa',p)).id,'confirmacion-original');
  assert.deepEqual(peticiones[0],peticiones[1]);assert.equal(await leerOperacionPendiente(usuario),null);
});
test('sesión vencida y respuestas inválidas mantienen operación pendiente; rechazo definitivo permite corregir',async()=>{
  const usuario=crypto.randomUUID(),p=operacion();
  for(const status of [401,502]) {
    globalThis.fetch=async()=>Response.json({message:'QA'},{status});
    await assert.rejects(ejecutarOperacionPersistida(usuario,'token-qa',p));assert.deepEqual(await leerOperacionPendiente(usuario),p);
  }
  globalThis.fetch=async()=>Response.json({message:'Stock insuficiente QA'},{status:409});
  await assert.rejects(ejecutarOperacionPersistida(usuario,'token-qa',p));assert.equal(await leerOperacionPendiente(usuario),null);
});
test('una operación pendiente no se envía a otra API ni aparece en otro usuario',async()=>{
  const usuario=crypto.randomUUID(),p=operacion();let llamadas=0;
  globalThis.fetch=async()=>{llamadas++;throw new Error('Sin red');};
  await assert.rejects(ejecutarOperacionPersistida(usuario,'token-qa',p));
  assert.equal(await leerOperacionPendiente(crypto.randomUUID()),null);
  await configurarDireccionApi('http://10.0.2.3:3001');
  await assert.rejects(ejecutarOperacionPersistida(usuario,'token-qa',p),/otra API/);assert.equal(llamadas,1);
  await configurarDireccionApi('http://10.0.2.2:3001');
});
test('GPS desactivado o sin permiso impide obtener posición y registrar una salida',async()=>{
  let lecturas=0;
  const proveedor={Accuracy:{High:4},hasServicesEnabledAsync:async()=>false,requestForegroundPermissionsAsync:async()=>({status:'denied'}),getCurrentPositionAsync:async()=>{lecturas++;return {coords:{latitude:-21.53,longitude:-64.73,accuracy:6},timestamp:Date.now()};}};
  await assert.rejects(capturarUbicacionPuntual(proveedor),/Activa/);
  proveedor.hasServicesEnabledAsync=async()=>true;
  await assert.rejects(capturarUbicacionPuntual(proveedor),/autorizar/);assert.equal(lecturas,0);
  proveedor.requestForegroundPermissionsAsync=async()=>({status:'granted'});
  const p=await capturarUbicacionPuntual(proveedor);assert.equal(lecturas,1);assert.equal(p.coords.accuracy,6);
});

import pg from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const url = new URL(process.env.DATABASE_URL ?? '');
const db = url.pathname.replace(/^\//, '');
if (process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1'].includes(url.hostname) || db !== 'zav_test') {
  throw new Error('Prohibido ejecutar esta medición fuera de la base de ensayo local zav_test.');
}

const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  const vendedor = await client.query("SELECT id FROM usuario WHERE rol='VENDEDOR' LIMIT 1");
  if (vendedor.rowCount !== 1) throw new Error('No existe la cuenta sintética del Vendedor.');
  const producto = await client.query(
    "INSERT INTO producto (codigo,nombre,familia,presentacion,peso_gramos,precio_bob) VALUES ('QA-REND-100', 'Producto sintético QA', 'PRUEBAS','Unidad',100,10.00) RETURNING id"
  );
  const cliente = await client.query(
    "INSERT INTO cliente (nombre,direccion) VALUES ('Cliente sintético QA', 'Dirección ficticia de pruebas') RETURNING id"
  );
  const pedido = await client.query(
    `INSERT INTO pedido (cliente_id,vendedor_id,estado,direccion_entrega)
     SELECT $1::uuid,$2::uuid,'REGISTRADO', 'Domicilio ficticio QA ' || n::text
     FROM generate_series(1,100) AS n RETURNING id`,
    [cliente.rows[0].id, vendedor.rows[0].id]
  );
  if (pedido.rowCount !== 100) throw new Error('No se generaron exactamente cien pedidos sintéticos.');
  const detalles = await client.query(
    `INSERT INTO detalle_pedido (pedido_id,producto_id,cantidad,precio_unitario_bob)
     SELECT p.id,$1::uuid,1,10.00 FROM pedido p RETURNING id`,
    [producto.rows[0].id]
  );
  if (detalles.rowCount !== 100) throw new Error('El ensayo necesita cien detalles de pedido.');
} finally {
  await client.end();
}

const base = 'http://127.0.0.1:3001';
const login = await fetch(base + '/api/v1/auth/login', {
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({identificador:process.env.QA_ADMIN_IDENTIFICADOR,contrasena:process.env.QA_ADMIN_PASSWORD})
});
if (!login.ok) throw new Error('No se pudo autenticar la cuenta QA: HTTP '+login.status);
const {accessToken} = await login.json();
if (!accessToken) throw new Error('No se recibió el token QA.');
const muestras = [];
let total;
for(let i=0;i<25;i++){
  const inicio=performance.now();
  const respuesta=await fetch(base+'/api/v1/admin/pedidos?limit=100&page=1',{
    headers:{Authorization:'Bearer '+accessToken},
    cache:'no-store'
  });
  const datos=await respuesta.json();
  const tiempo=performance.now()-inicio;
  if(respuesta.status!==200||datos.items?.length!==100||datos.total!==100){
    throw new Error('Resultado no satisfactorio: HTTP '+respuesta.status+', filas '+datos.items?.length+', total '+datos.total);
  }
  total=datos.total;
  muestras.push(Number(tiempo.toFixed(3)));
}
const tiempos=[...muestras].sort((a,b)=>a-b);
const suma=muestras.reduce((a,b)=>a+b,0);
const resultado={
  fecha_utc:new Date().toISOString(),
  entorno:'PostgreSQL 18 local aislado y NestJS de pruebas en GitHub Actions',
  endpoint:'GET /api/v1/admin/pedidos?limit=100&page=1',
  credenciales:'Cuenta sintética Administrador, JWT de ensayo',
  registros_sinteticos:total, solicitudes:25, concurrencia:1,
  unidad:'milisegundos', minimo:tiempos[0], mediana:tiempos[12],
  percentil_95:tiempos[Math.ceil(0.95*tiempos.length)-1],maximo:tiempos[24],
  promedio:Number((suma/25).toFixed(3)), muestras,
  advertencia:'Medición funcional en entorno de ensayo aislado. No representa latencia de producción ni tiempo de pantalla.'
};
mkdirSync('evidencia-cierre',{recursive:true});
writeFileSync('evidencia-cierre/rendimiento-pedidos-qa.json',JSON.stringify(resultado,null,2)+'\n');
console.log(JSON.stringify({...resultado,muestras:undefined},null,2));

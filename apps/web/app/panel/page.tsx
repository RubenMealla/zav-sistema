import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { cerrarSesion } from '../acciones';
import { registrarLote, registrarProducto } from './acciones';

const API = process.env.API_BASE_URL ?? 'http://localhost:3001';
type Producto = { id: string; codigo: string; nombre: string; familia: string; presentacion: string; pesoGramos: number; precioBob: string; activo: boolean };
type Saldo = { codigo: string; cantidad_fisica: number; cantidad_comprometida: number };
type Lote = { id: string; codigo: string; productoId: string; condicion: string; venceEl: string; existencias: Saldo[] };
type Pagina<T> = { items: T[]; total: number };
type Perfil = { nombre: string; identificador: string; rol: string };

async function consultar<T>(ruta: string, token: string): Promise<{ estado: number; datos?: T }> {
  const respuesta = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!respuesta.ok) return { estado: respuesta.status };
  return { estado: respuesta.status, datos: (await respuesta.json()) as T };
}

const mensajes: Record<string, string> = {
  codigo: 'Ya existe un producto con ese código.',
  'lote-duplicado': 'El código de lote o la clave de operación ya está registrado.',
  conexion: 'No se pudo conectar con la API de ZAV.',
  producto: 'No se registró el producto. Revisa los datos y vuelve a intentar.',
  lote: 'No se registró el lote. Comprueba fechas, ubicación y cantidad.',
};

export default async function Panel({ searchParams }: { searchParams: Promise<{ error?: string; mensaje?: string }> }) {
  const token = (await cookies()).get('zav_acceso')?.value;
  if (!token) redirect('/acceso?error=sesion');
  let perfil: { estado: number; datos?: Perfil };
  let productos: { estado: number; datos?: Pagina<Producto> };
  let lotes: { estado: number; datos?: Pagina<Lote> };
  try {
    perfil = await consultar<Perfil>('/api/v1/auth/me', token);
    [productos, lotes] = await Promise.all([
      consultar<Pagina<Producto>>('/api/v1/productos?limit=30', token),
      consultar<Pagina<Lote>>('/api/v1/lotes?limit=30', token),
    ]);
  } catch {
    return <main className="error-pagina"><h1>No se pudo cargar el panel</h1><p>Comprueba que la API de NestJS está encendida y que API_BASE_URL es correcto.</p><Link href="/acceso">Volver al acceso</Link></main>;
  }
  if (perfil.estado === 401 || perfil.estado === 403) redirect('/acceso?error=sesion');
  if (perfil.datos?.rol !== 'ADMINISTRADOR') redirect('/acceso?error=permisos');
  const { error, mensaje } = await searchParams;
  const itemsProductos = productos.datos?.items ?? [];
  const itemsLotes = lotes.datos?.items ?? [];
  return <div className="panel-marco"><aside className="lateral"><Link href="/" className="marca"><span className="marca-simbolo">Z</span><span>ZAV <small>Administración</small></span></Link>
    <nav className="menu" aria-label="Menú del panel"><a href="#resumen">Resumen</a><a href="#productos">Productos</a><a href="#lotes">Lotes y existencias</a></nav>
    <form action={cerrarSesion}><button type="submit" className="salir">Cerrar sesión ↗</button></form></aside>
    <main className="panel-principal"><header className="cabecera"><div><span className="etiqueta">SISTEMA INTERNO · DESARROLLO</span><h1 id="resumen">Panel de inventario</h1><p>Bienvenido, {perfil.datos?.nombre}. Consulta y registra productos terminados y lotes.</p></div><span className="usuario">{perfil.datos?.identificador} · Administrador</span></header>
    {mensaje && <p role="status" className="alerta alerta-ok">{mensaje === 'producto' ? 'Producto registrado correctamente.' : 'Lote e ingreso inicial registrados correctamente.'}</p>}
    {error && <p role="alert" className="alerta alerta-error">{mensajes[error] ?? 'No se pudo completar la operación.'}</p>}
    <div className="resumen-cifras"><div><small>Productos registrados</small><strong>{productos.datos?.total ?? '—'}</strong></div><div><small>Lotes registrados</small><strong>{lotes.datos?.total ?? '—'}</strong></div><div><small>Disponibilidad comercial</small><strong>Sin liberar</strong></div></div>
    <section className="seccion" id="productos"><div className="seccion-encabezado"><div><span className="etiqueta">01 · CATÁLOGO INTERNO</span><h2>Productos terminados</h2></div><p>Datos consultados desde la API.</p></div>
      {productos.estado !== 200 ? <p className="alerta alerta-error">No se pudo consultar la lista de productos (HTTP {productos.estado}).</p> : <div className="tabla-contenedor"><table><thead><tr><th>Código</th><th>Nombre</th><th>Familia</th><th>Presentación</th><th>Precio (Bs)</th></tr></thead><tbody>{itemsProductos.length === 0 ? <tr><td colSpan={5}>Todavía no hay productos registrados.</td></tr> : itemsProductos.map(p => <tr key={p.id}><td className="codigo">{p.codigo}</td><td>{p.nombre}</td><td>{p.familia}</td><td>{p.presentacion}</td><td>{p.precioBob}</td></tr>)}</tbody></table></div>}
      <details className="formulario-desplegable"><summary>+ Registrar producto</summary><form action={registrarProducto} className="formulario formulario-grid"><label>Código<input name="codigo" minLength={2} maxLength={40} required placeholder="SAL-500" /></label><label>Nombre<input name="nombre" maxLength={120} required placeholder="Salchicha Viena" /></label><label>Familia<input name="familia" maxLength={70} required placeholder="Salchichas" /></label><label>Presentación<input name="presentacion" maxLength={100} required placeholder="Paquete de 500 gramos" /></label><label>Peso (gramos)<input name="pesoGramos" type="number" min={1} step={1} required /></label><label>Precio (Bs)<input name="precioBob" type="number" min={0} step="0.01" required /></label><button type="submit" className="boton boton-oscuro">Guardar producto</button></form></details>
    </section>
    <section className="seccion" id="lotes"><div className="seccion-encabezado"><div><span className="etiqueta">02 · TRAZABILIDAD</span><h2>Lotes y existencias</h2></div><p>Los lotes nuevos quedan retenidos hasta su liberación.</p></div>
      {lotes.estado !== 200 ? <p className="alerta alerta-error">No se pudo consultar la lista de lotes (HTTP {lotes.estado}).</p> : <div className="tabla-contenedor"><table><thead><tr><th>Lote</th><th>Condición</th><th>Vencimiento</th><th>Ubicación y existencia física</th></tr></thead><tbody>{itemsLotes.length === 0 ? <tr><td colSpan={4}>Todavía no hay lotes registrados.</td></tr> : itemsLotes.map(l => <tr key={l.id}><td className="codigo">{l.codigo}</td><td><span className="estado">{l.condicion}</span></td><td>{l.venceEl}</td><td>{l.existencias?.map(e => `${e.codigo}: ${e.cantidad_fisica}`).join(' · ') || 'Sin existencias'}</td></tr>)}</tbody></table></div>}
      <details className="formulario-desplegable"><summary>+ Registrar lote e ingreso inicial</summary><form action={registrarLote} className="formulario formulario-grid"><input type="hidden" name="operacionClave" value={randomUUID()} /><label>Producto<select name="productoId" required defaultValue=""><option value="" disabled>Selecciona un producto</option>{itemsProductos.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}</select></label><label>Código de lote<input name="codigo" minLength={2} maxLength={60} required placeholder="LT-2026-001" /></label><label>Fecha de elaboración<input name="elaboradoEl" type="date" required /></label><label>Fecha de vencimiento<input name="venceEl" type="date" required /></label><label>Cantidad inicial (paquetes)<input name="cantidadInicial" type="number" min={1} step={1} required /></label><label>Ubicación inicial<input value="Producción y Almacenamiento" readOnly aria-label="Ubicación inicial" /></label><button type="submit" className="boton boton-oscuro" disabled={itemsProductos.length === 0}>Guardar lote e ingreso</button></form></details>
    </section><footer className="pie">ZAV · Gestión de productos terminados · Entorno de desarrollo</footer></main></div>;
}

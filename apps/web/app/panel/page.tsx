import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { cerrarSesion } from '../acciones';
import { cambiarCondicionLote, registrarLote, registrarProducto, registrarTraslado } from './acciones';

const API = process.env.API_BASE_URL ?? 'http://localhost:3001';
type Producto = { id: string; codigo: string; nombre: string; familia: string; presentacion: string; pesoGramos: number; precioBob: string; activo: boolean };
type Saldo = { codigo: string; cantidad_fisica: number; cantidad_comprometida: number };
type Lote = { id: string; codigo: string; productoId: string; condicion: string; venceEl: string; existencias: Saldo[] };
type Movimiento = {
  id: string;
  tipo: string;
  cantidad: number;
  creadoEn: string;
  referencia: string | null;
  origen: { codigo: string; nombre: string } | null;
  destino: { codigo: string; nombre: string } | null;
  usuario: { identificador: string; nombre: string };
};
type EventoCondicion = {
  id: string;
  condicionAnterior: string;
  condicionNueva: string;
  motivo: string;
  creadoEn: string;
  usuario: { identificador: string; nombre: string };
};
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
  'traslado-conflicto': 'No se pudo trasladar. Revisa el saldo disponible y vuelve a intentar.',
  'condicion-conflicto': 'No se pudo cambiar la condición. Revisa el estado actual, la vigencia del lote y vuelve a intentar.',
  conexion: 'No se pudo conectar con la API de ZAV.',
  producto: 'No se registró el producto. Revisa los datos y vuelve a intentar.',
  lote: 'No se registró el lote. Comprueba fechas, ubicación y cantidad.',
  traslado: 'No se registró el traslado. Revisa lote, ubicaciones y cantidad.',
  condicion: 'No se cambió la condición del lote. Revisa los datos y vuelve a intentar.',
};

const mensajesOk: Record<string, string> = {
  producto: 'Producto registrado correctamente.',
  lote: 'Lote e ingreso inicial registrados correctamente.',
  traslado: 'Traslado registrado correctamente.',
  condicion: 'Condición del lote actualizada correctamente.',
};

export default async function Panel({ searchParams }: { searchParams: Promise<{ error?: string; mensaje?: string; historialLoteId?: string; historialCondicionLoteId?: string }> }) {
  const token = (await cookies()).get('zav_acceso')?.value;
  if (!token) redirect('/acceso?error=sesion');

  const parametros = await searchParams;
  let perfil: { estado: number; datos?: Perfil };
  let productos: { estado: number; datos?: Pagina<Producto> };
  let lotes: { estado: number; datos?: Pagina<Lote> };
  let movimientos: { estado: number; datos?: Pagina<Movimiento> } | undefined;
  let condiciones: { estado: number; datos?: Pagina<EventoCondicion> } | undefined;

  try {
    perfil = await consultar<Perfil>('/api/v1/auth/me', token);
    [productos, lotes] = await Promise.all([
      consultar<Pagina<Producto>>('/api/v1/productos?limit=30', token),
      consultar<Pagina<Lote>>('/api/v1/lotes?limit=30', token),
    ]);
    if (parametros.historialLoteId) {
      movimientos = await consultar<Pagina<Movimiento>>(
        `/api/v1/movimientos?loteId=${encodeURIComponent(parametros.historialLoteId)}&limit=30`,
        token,
      );
    }
    if (parametros.historialCondicionLoteId) {
      condiciones = await consultar<Pagina<EventoCondicion>>(
        `/api/v1/lotes/${encodeURIComponent(parametros.historialCondicionLoteId)}/condiciones?limit=30`,
        token,
      );
    }
  } catch {
    return <main className="error-pagina"><h1>No se pudo cargar el panel</h1><p>Comprueba que la API de NestJS está encendida y que API_BASE_URL es correcto.</p><Link href="/acceso">Volver al acceso</Link></main>;
  }

  if (perfil.estado === 401 || perfil.estado === 403) redirect('/acceso?error=sesion');
  if (perfil.datos?.rol !== 'ADMINISTRADOR') redirect('/acceso?error=permisos');

  const itemsProductos = productos.datos?.items ?? [];
  const itemsLotes = lotes.datos?.items ?? [];
  const itemsMovimientos = movimientos?.datos?.items ?? [];
  const itemsCondiciones = condiciones?.datos?.items ?? [];
  const loteHistorial = itemsLotes.find((lote) => lote.id === parametros.historialLoteId);
  const loteHistorialCondicion = itemsLotes.find((lote) => lote.id === parametros.historialCondicionLoteId);
  const lotesLiberados = itemsLotes.filter((lote) => lote.condicion === 'LIBERADO').length;

  return <div className="panel-marco"><aside className="lateral"><Link href="/" className="marca"><span className="marca-simbolo">Z</span><span>ZAV <small>Administración</small></span></Link>
    <nav className="menu" aria-label="Menú del panel"><a href="#resumen">Resumen</a><a href="#productos">Productos</a><a href="#lotes">Lotes y existencias</a><a href="#condiciones">Condición de lotes</a><a href="#movimientos">Movimientos</a></nav>
    <form action={cerrarSesion}><button type="submit" className="salir">Cerrar sesión ↗</button></form></aside>
    <main className="panel-principal"><header className="cabecera"><div><span className="etiqueta">SISTEMA INTERNO · DESARROLLO</span><h1 id="resumen">Panel de inventario</h1><p>Bienvenido, {perfil.datos?.nombre}. Consulta y registra productos terminados, lotes y traslados.</p></div><span className="usuario">{perfil.datos?.identificador} · Administrador</span></header>
    {parametros.mensaje && <p role="status" className="alerta alerta-ok">{mensajesOk[parametros.mensaje] ?? 'Operación registrada correctamente.'}</p>}
    {parametros.error && <p role="alert" className="alerta alerta-error">{mensajes[parametros.error] ?? 'No se pudo completar la operación.'}</p>}
    <div className="resumen-cifras"><div><small>Productos registrados</small><strong>{productos.datos?.total ?? '—'}</strong></div><div><small>Lotes registrados</small><strong>{lotes.datos?.total ?? '—'}</strong></div><div><small>Lotes liberados</small><strong>{lotesLiberados}</strong></div></div>

    <section className="seccion" id="productos"><div className="seccion-encabezado"><div><span className="etiqueta">01 · CATÁLOGO INTERNO</span><h2>Productos terminados</h2></div><p>Datos consultados desde la API.</p></div>
      {productos.estado !== 200 ? <p className="alerta alerta-error">No se pudo consultar la lista de productos (HTTP {productos.estado}).</p> : <div className="tabla-contenedor"><table><thead><tr><th>Código</th><th>Nombre</th><th>Familia</th><th>Presentación</th><th>Precio (Bs)</th></tr></thead><tbody>{itemsProductos.length === 0 ? <tr><td colSpan={5}>Todavía no hay productos registrados.</td></tr> : itemsProductos.map(p => <tr key={p.id}><td className="codigo">{p.codigo}</td><td>{p.nombre}</td><td>{p.familia}</td><td>{p.presentacion}</td><td>{p.precioBob}</td></tr>)}</tbody></table></div>}
      <details className="formulario-desplegable"><summary>+ Registrar producto</summary><form action={registrarProducto} className="formulario formulario-grid"><label>Código<input name="codigo" minLength={2} maxLength={40} required placeholder="SAL-500" /></label><label>Nombre<input name="nombre" maxLength={120} required placeholder="Salchicha Viena" /></label><label>Familia<input name="familia" maxLength={70} required placeholder="Salchichas" /></label><label>Presentación<input name="presentacion" maxLength={100} required placeholder="Paquete de 500 gramos" /></label><label>Peso (gramos)<input name="pesoGramos" type="number" min={1} step={1} required /></label><label>Precio (Bs)<input name="precioBob" type="number" min={0} step="0.01" required /></label><button type="submit" className="boton boton-oscuro">Guardar producto</button></form></details>
    </section>

    <section className="seccion" id="lotes"><div className="seccion-encabezado"><div><span className="etiqueta">02 · TRAZABILIDAD</span><h2>Lotes y existencias</h2></div><p>Los lotes nuevos quedan retenidos hasta su liberación.</p></div>
      {lotes.estado !== 200 ? <p className="alerta alerta-error">No se pudo consultar la lista de lotes (HTTP {lotes.estado}).</p> : <div className="tabla-contenedor"><table><thead><tr><th>Lote</th><th>Condición</th><th>Vencimiento</th><th>Ubicación y existencia física</th></tr></thead><tbody>{itemsLotes.length === 0 ? <tr><td colSpan={4}>Todavía no hay lotes registrados.</td></tr> : itemsLotes.map(l => <tr key={l.id}><td className="codigo">{l.codigo}</td><td><span className="estado">{l.condicion}</span></td><td>{l.venceEl}</td><td>{l.existencias?.map(e => `${e.codigo}: ${e.cantidad_fisica}`).join(' · ') || 'Sin existencias'}</td></tr>)}</tbody></table></div>}
      <details className="formulario-desplegable"><summary>+ Registrar lote e ingreso inicial</summary><form action={registrarLote} className="formulario formulario-grid"><input type="hidden" name="operacionClave" value={randomUUID()} /><label>Producto<select name="productoId" required defaultValue=""><option value="" disabled>Selecciona un producto</option>{itemsProductos.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}</select></label><label>Código de lote<input name="codigo" minLength={2} maxLength={60} required placeholder="LT-2026-001" /></label><label>Fecha de elaboración<input name="elaboradoEl" type="date" required /></label><label>Fecha de vencimiento<input name="venceEl" type="date" required /></label><label>Cantidad inicial (paquetes)<input name="cantidadInicial" type="number" min={1} step={1} required /></label><label>Ubicación inicial<input value="Producción y Almacenamiento" readOnly aria-label="Ubicación inicial" /></label><button type="submit" className="boton boton-oscuro" disabled={itemsProductos.length === 0}>Guardar lote e ingreso</button></form></details>
    </section>

    <section className="seccion" id="condiciones"><div className="seccion-encabezado"><div><span className="etiqueta">03 · CONDICIÓN COMERCIAL</span><h2>Liberación y bloqueo</h2></div><p>La condición del lote es independiente de su ubicación física.</p></div>
      <details className="formulario-desplegable"><summary>+ Cambiar condición del lote</summary><form action={cambiarCondicionLote} className="formulario formulario-grid"><input type="hidden" name="operacionClave" value={randomUUID()} /><label>Lote<select name="loteId" required defaultValue=""><option value="" disabled>Selecciona un lote</option>{itemsLotes.map(l => <option key={l.id} value={l.id}>{l.codigo} · {l.condicion}</option>)}</select></label><label>Acción<select name="accion" required defaultValue="liberar"><option value="liberar">Liberar para disponibilidad comercial</option><option value="bloquear">Bloquear lote</option></select></label><label>Motivo<input name="motivo" maxLength={250} required placeholder="Motivo de la decisión" /></label><button type="submit" className="boton boton-oscuro" disabled={itemsLotes.length === 0}>Guardar condición</button></form></details>

      <form method="get" className="formulario formulario-grid">
        <label>Ver historial de condición<select name="historialCondicionLoteId" defaultValue={parametros.historialCondicionLoteId ?? ''} required><option value="" disabled>Selecciona un lote</option>{itemsLotes.map(l => <option key={l.id} value={l.id}>{l.codigo}</option>)}</select></label>
        <button type="submit" className="boton boton-oscuro" disabled={itemsLotes.length === 0}>Consultar cambios</button>
      </form>

      {!parametros.historialCondicionLoteId ? <p>Selecciona un lote para consultar sus cambios de condición.</p> :
        condiciones?.estado !== 200 ? <p className="alerta alerta-error">No se pudo consultar el historial de condición (HTTP {condiciones?.estado ?? '—'}).</p> :
        <div className="tabla-contenedor"><table><thead><tr><th>Fecha</th><th>Lote</th><th>Anterior</th><th>Nueva</th><th>Motivo</th><th>Usuario</th></tr></thead><tbody>{itemsCondiciones.length === 0 ? <tr><td colSpan={6}>El lote todavía no tiene cambios de condición.</td></tr> : itemsCondiciones.map(evento => <tr key={evento.id}><td>{new Date(evento.creadoEn).toLocaleString('es-BO')}</td><td className="codigo">{loteHistorialCondicion?.codigo ?? '—'}</td><td>{evento.condicionAnterior}</td><td>{evento.condicionNueva}</td><td>{evento.motivo}</td><td>{evento.usuario.identificador}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="seccion" id="movimientos"><div className="seccion-encabezado"><div><span className="etiqueta">04 · MOVIMIENTOS</span><h2>Traslados e historial</h2></div><p>Mover un lote no cambia su condición. Un lote RETENIDO sigue retenido.</p></div>
      <details className="formulario-desplegable"><summary>+ Registrar traslado</summary><form action={registrarTraslado} className="formulario formulario-grid"><input type="hidden" name="operacionClave" value={randomUUID()} /><label>Lote a trasladar<select name="loteId" required defaultValue=""><option value="" disabled>Selecciona un lote</option>{itemsLotes.map(l => <option key={l.id} value={l.id}>{l.codigo} · {l.condicion}</option>)}</select></label><label>Origen<select name="origenCodigo" required defaultValue="PRODUCCION_ALMACENAMIENTO"><option value="PRODUCCION_ALMACENAMIENTO">Producción y Almacenamiento</option><option value="VENTA_DESPACHO">Venta y Despacho</option></select></label><label>Destino<select name="destinoCodigo" required defaultValue="VENTA_DESPACHO"><option value="VENTA_DESPACHO">Venta y Despacho</option><option value="PRODUCCION_ALMACENAMIENTO">Producción y Almacenamiento</option></select></label><label>Cantidad a trasladar<input name="cantidad" type="number" min={1} step={1} required /></label><label>Referencia (opcional)<input name="referencia" maxLength={80} placeholder="Ej. TR-001" /></label><label>Motivo (opcional)<input name="motivo" maxLength={250} placeholder="Motivo del movimiento" /></label><button type="submit" className="boton boton-oscuro" disabled={itemsLotes.length === 0}>Guardar traslado</button></form></details>

      <form method="get" className="formulario formulario-grid">
        <label>Ver historial del lote<select name="historialLoteId" defaultValue={parametros.historialLoteId ?? ''} required><option value="" disabled>Selecciona un lote</option>{itemsLotes.map(l => <option key={l.id} value={l.id}>{l.codigo}</option>)}</select></label>
        <button type="submit" className="boton boton-oscuro" disabled={itemsLotes.length === 0}>Consultar historial</button>
      </form>

      {!parametros.historialLoteId ? <p>Selecciona un lote para consultar sus movimientos.</p> :
        movimientos?.estado !== 200 ? <p className="alerta alerta-error">No se pudo consultar el historial (HTTP {movimientos?.estado ?? '—'}).</p> :
        <div className="tabla-contenedor"><table><thead><tr><th>Fecha</th><th>Lote</th><th>Tipo</th><th>Origen</th><th>Destino</th><th>Cantidad</th><th>Usuario</th></tr></thead><tbody>{itemsMovimientos.length === 0 ? <tr><td colSpan={7}>El lote no tiene movimientos.</td></tr> : itemsMovimientos.map(m => <tr key={m.id}><td>{new Date(m.creadoEn).toLocaleString('es-BO')}</td><td className="codigo">{loteHistorial?.codigo ?? '—'}</td><td>{m.tipo}</td><td>{m.origen?.nombre ?? '—'}</td><td>{m.destino?.nombre ?? '—'}</td><td>{m.cantidad}</td><td>{m.usuario.identificador}</td></tr>)}</tbody></table></div>}
    </section>
    <footer className="pie">ZAV · Gestión de productos terminados · Entorno de desarrollo</footer></main></div>;
}

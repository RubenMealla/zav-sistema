import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { cerrarSesion } from '../acciones';
import { Icono } from '../componentes/icono';
import { Modal, Notificacion } from '../componentes/interacciones';
import { cambiarCondicionLote, registrarLote, registrarProducto, registrarTraslado } from './acciones';

const API = process.env.API_BASE_URL ?? 'http://localhost:3001';

type Producto = {
  id: string;
  codigo: string;
  nombre: string;
  familia: string;
  presentacion: string;
  pesoGramos: number;
  precioBob: string;
  activo: boolean;
};

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
type Vista = 'resumen' | 'productos' | 'lotes' | 'condiciones' | 'movimientos';

const vistas: Record<Vista, { titulo: string; descripcion: string; icono: 'inicio' | 'producto' | 'lote' | 'condicion' | 'movimiento' }> = {
  resumen: { titulo: 'Resumen general', descripcion: 'Estado operativo del inventario y accesos rápidos.', icono: 'inicio' },
  productos: { titulo: 'Productos terminados', descripcion: 'Presentaciones comerciales registradas en el sistema.', icono: 'producto' },
  lotes: { titulo: 'Lotes y existencias', descripcion: 'Existencia física, vencimientos y ubicación de cada lote.', icono: 'lote' },
  condiciones: { titulo: 'Condición de lotes', descripcion: 'Liberación, bloqueo y auditoría de decisiones comerciales.', icono: 'condicion' },
  movimientos: { titulo: 'Movimientos', descripcion: 'Traslados entre ubicaciones e historial de inventario.', icono: 'movimiento' },
};

const mensajes: Record<string, string> = {
  codigo: 'Ya existe un producto con ese código.',
  'lote-duplicado': 'El código de lote o la clave de operación ya está registrado.',
  'traslado-conflicto': 'No se pudo trasladar. Revisa el saldo disponible.',
  'condicion-conflicto': 'No se pudo cambiar la condición. Revisa estado, vigencia y producto.',
  conexion: 'No se pudo conectar con la API de ZAV.',
  producto: 'No se registró el producto. Revisa los datos.',
  lote: 'No se registró el lote. Comprueba fechas, ubicación y cantidad.',
  traslado: 'No se registró el traslado. Revisa lote, ubicaciones y cantidad.',
  condicion: 'No se cambió la condición del lote. Revisa los datos.',
};

const mensajesOk: Record<string, string> = {
  producto: 'Producto registrado correctamente.',
  lote: 'Lote e ingreso inicial registrados correctamente.',
  traslado: 'Traslado registrado correctamente.',
  condicion: 'Condición del lote actualizada correctamente.',
};

async function consultar<T>(ruta: string, token: string): Promise<{ estado: number; datos?: T }> {
  const respuesta = await fetch(`${API}${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!respuesta.ok) return { estado: respuesta.status };
  return { estado: respuesta.status, datos: (await respuesta.json()) as T };
}

function condicionClase(condicion: string) {
  if (condicion === 'LIBERADO') return 'badge badge-verde';
  if (condicion === 'BLOQUEADO') return 'badge badge-rojo';
  return 'badge badge-ambar';
}

function fechaBolivia(valor: string) {
  return new Date(valor).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
}

export default async function Panel({
  searchParams,
}: {
  searchParams: Promise<{
    vista?: string;
    error?: string;
    mensaje?: string;
    historialLoteId?: string;
    historialCondicionLoteId?: string;
  }>;
}) {
  const token = (await cookies()).get('zav_acceso')?.value;
  if (!token) redirect('/acceso?error=sesion');

  const parametros = await searchParams;
  const vista: Vista = parametros.vista && parametros.vista in vistas ? parametros.vista as Vista : 'resumen';

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

    if (vista === 'movimientos' && parametros.historialLoteId) {
      movimientos = await consultar<Pagina<Movimiento>>(
        `/api/v1/movimientos?loteId=${encodeURIComponent(parametros.historialLoteId)}&limit=30`,
        token,
      );
    }

    if (vista === 'condiciones' && parametros.historialCondicionLoteId) {
      condiciones = await consultar<Pagina<EventoCondicion>>(
        `/api/v1/lotes/${encodeURIComponent(parametros.historialCondicionLoteId)}/condiciones?limit=30`,
        token,
      );
    }
  } catch {
    return (
      <main className="error-pagina">
        <span className="error-icono"><Icono nombre="alerta" tamano={26} /></span>
        <h1>No se pudo cargar el panel</h1>
        <p>Comprueba la conexión con la API de ZAV e intenta nuevamente.</p>
        <Link className="boton boton-primario" href="/acceso">Volver al acceso</Link>
      </main>
    );
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
  const lotesRetenidos = itemsLotes.filter((lote) => lote.condicion === 'RETENIDO').length;
  const lotesBloqueados = itemsLotes.filter((lote) => lote.condicion === 'BLOQUEADO').length;
  const totalFisico = itemsLotes.reduce(
    (total, lote) => total + (lote.existencias ?? []).reduce((subtotal, saldo) => subtotal + saldo.cantidad_fisica, 0),
    0,
  );
  const inicial = perfil.datos?.nombre?.trim().charAt(0).toUpperCase() || 'A';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-superior">
          <Link href="/" className="logo logo-sidebar">
            <span className="logo-marca">Z</span>
            <span>ZAV <small>Administración</small></span>
          </Link>
          <span className="sidebar-entorno"><span /> Entorno de desarrollo</span>
        </div>

        <nav className="sidebar-nav" aria-label="Módulos del sistema">
          <span className="sidebar-seccion">PRINCIPAL</span>
          {(Object.entries(vistas) as Array<[Vista, typeof vistas[Vista]]>).map(([clave, item]) => (
            <Link
              key={clave}
              href={`/panel?vista=${clave}`}
              className={vista === clave ? 'nav-item nav-item-activo' : 'nav-item'}
              aria-current={vista === clave ? 'page' : undefined}
            >
              <span className="nav-icono"><Icono nombre={item.icono} /></span>
              <span>{item.titulo}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-pie">
          <div className="perfil-mini">
            <span className="avatar">{inicial}</span>
            <div><strong>{perfil.datos?.nombre}</strong><span>{perfil.datos?.identificador}</span></div>
          </div>
          <form action={cerrarSesion}>
            <button type="submit" className="boton-cerrar-sesion">
              Cerrar sesión <span>↗</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="contenido">
        <header className="topbar">
          <div className="topbar-titulo">
            <div className="breadcrumb"><span>ZAV</span><span>/</span><strong>{vistas[vista].titulo}</strong></div>
            <h1>{vistas[vista].titulo}</h1>
            <p>{vistas[vista].descripcion}</p>
          </div>
          <div className="topbar-derecha">
            <span className="topbar-fecha">Gestión 2026</span>
            <div className="avatar avatar-claro">{inicial}</div>
          </div>
        </header>

        <nav className="nav-movil" aria-label="Módulos">
          {(Object.entries(vistas) as Array<[Vista, typeof vistas[Vista]]>).map(([clave, item]) => (
            <Link key={clave} href={`/panel?vista=${clave}`} className={vista === clave ? 'activo' : ''}>
              <Icono nombre={item.icono} tamano={17} /><span>{item.titulo}</span>
            </Link>
          ))}
        </nav>

        {parametros.mensaje && <Notificacion tipo="exito" mensaje={mensajesOk[parametros.mensaje] ?? 'Operación registrada correctamente.'} />}
        {parametros.error && <Notificacion tipo="error" mensaje={mensajes[parametros.error] ?? 'No se pudo completar la operación.'} />}

        <div className="vista-contenido">
          {vista === 'resumen' && (
            <>
              <section className="bienvenida">
                <div>
                  <span className="eyebrow">RESUMEN OPERATIVO</span>
                  <h2>Hola, {perfil.datos?.nombre?.split(' ')[0]}.</h2>
                  <p>Consulta el estado actual y entra directamente al módulo que necesitas.</p>
                </div>
                <span className="bienvenida-icono"><Icono nombre="escudo" tamano={28} /></span>
              </section>

              <section className="metricas-grid">
                <article className="metrica-card">
                  <span className="metrica-icono"><Icono nombre="producto" /></span>
                  <div><span>Productos</span><strong>{productos.datos?.total ?? '—'}</strong><small>Registrados</small></div>
                </article>
                <article className="metrica-card">
                  <span className="metrica-icono"><Icono nombre="lote" /></span>
                  <div><span>Lotes</span><strong>{lotes.datos?.total ?? '—'}</strong><small>En seguimiento</small></div>
                </article>
                <article className="metrica-card">
                  <span className="metrica-icono metrica-verde"><Icono nombre="condicion" /></span>
                  <div><span>Liberados</span><strong>{lotesLiberados}</strong><small>Condición comercial</small></div>
                </article>
                <article className="metrica-card">
                  <span className="metrica-icono"><Icono nombre="ubicacion" /></span>
                  <div><span>Existencia física</span><strong>{totalFisico}</strong><small>Unidades registradas</small></div>
                </article>
              </section>

              <div className="dashboard-grid">
                <section className="card">
                  <div className="card-cabecera">
                    <div><span className="eyebrow">ACCESOS RÁPIDOS</span><h2>Trabaja por módulo</h2></div>
                  </div>
                  <div className="accesos-grid">
                    <Link href="/panel?vista=productos" className="acceso-rapido"><span><Icono nombre="producto" /></span><div><strong>Productos</strong><p>Consulta y registra presentaciones.</p></div><b>→</b></Link>
                    <Link href="/panel?vista=lotes" className="acceso-rapido"><span><Icono nombre="lote" /></span><div><strong>Lotes</strong><p>Revisa existencias y vencimientos.</p></div><b>→</b></Link>
                    <Link href="/panel?vista=condiciones" className="acceso-rapido"><span><Icono nombre="condicion" /></span><div><strong>Condiciones</strong><p>Libera, bloquea y audita.</p></div><b>→</b></Link>
                    <Link href="/panel?vista=movimientos" className="acceso-rapido"><span><Icono nombre="movimiento" /></span><div><strong>Movimientos</strong><p>Registra traslados y consulta historial.</p></div><b>→</b></Link>
                  </div>
                </section>

                <section className="card estado-card">
                  <div className="card-cabecera"><div><span className="eyebrow">CONDICIÓN DE LOTES</span><h2>Distribución actual</h2></div></div>
                  <div className="estado-resumen">
                    <div><span className="punto-estado punto-verde" /><span>Liberados</span><strong>{lotesLiberados}</strong></div>
                    <div><span className="punto-estado punto-ambar" /><span>Retenidos</span><strong>{lotesRetenidos}</strong></div>
                    <div><span className="punto-estado punto-rojo" /><span>Bloqueados</span><strong>{lotesBloqueados}</strong></div>
                  </div>
                  <p className="nota-card"><Icono nombre="escudo" tamano={15} /> La condición comercial es independiente de la ubicación física.</p>
                </section>
              </div>
            </>
          )}

          {vista === 'productos' && (
            <section className="card card-modulo">
              <div className="card-cabecera">
                <div>
                  <span className="eyebrow">CATÁLOGO INTERNO</span>
                  <h2>Productos registrados</h2>
                  <p>{productos.datos?.total ?? 0} productos disponibles para consulta administrativa.</p>
                </div>
                <Modal boton="Nuevo producto" titulo="Registrar producto" descripcion="Agrega una presentación comercial al catálogo interno.">
                  <form action={registrarProducto} className="formulario formulario-modal">
                    <div className="form-grid">
                      <label className="campo">Código<input name="codigo" minLength={2} maxLength={40} required placeholder="SAL-500" /></label>
                      <label className="campo">Nombre<input name="nombre" maxLength={120} required placeholder="Salchicha Viena" /></label>
                      <label className="campo">Familia<input name="familia" maxLength={70} required placeholder="Salchichas" /></label>
                      <label className="campo">Presentación<input name="presentacion" maxLength={100} required placeholder="Paquete de 500 gramos" /></label>
                      <label className="campo">Peso (gramos)<input name="pesoGramos" type="number" min={1} step={1} required /></label>
                      <label className="campo">Precio (Bs)<input name="precioBob" type="number" min={0} step="0.01" required /></label>
                    </div>
                    <div className="modal-acciones"><button type="submit" className="boton boton-primario">Guardar producto</button></div>
                  </form>
                </Modal>
              </div>

              {productos.estado !== 200 ? (
                <div className="estado-vacio estado-error"><Icono nombre="alerta" /><p>No se pudo consultar la lista de productos (HTTP {productos.estado}).</p></div>
              ) : (
                <div className="tabla-contenedor">
                  <table>
                    <thead><tr><th>Código</th><th>Producto</th><th>Familia</th><th>Presentación</th><th>Peso</th><th>Precio</th><th>Estado</th></tr></thead>
                    <tbody>
                      {itemsProductos.length === 0 ? (
                        <tr><td colSpan={7}><div className="tabla-vacia">Todavía no hay productos registrados.</div></td></tr>
                      ) : itemsProductos.map((producto) => (
                        <tr key={producto.id}>
                          <td><span className="codigo">{producto.codigo}</span></td>
                          <td><strong>{producto.nombre}</strong></td>
                          <td>{producto.familia}</td>
                          <td>{producto.presentacion}</td>
                          <td>{producto.pesoGramos} g</td>
                          <td><strong>Bs {producto.precioBob}</strong></td>
                          <td><span className={producto.activo ? 'badge badge-verde' : 'badge badge-neutro'}>{producto.activo ? 'ACTIVO' : 'INACTIVO'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {vista === 'lotes' && (
            <section className="card card-modulo">
              <div className="card-cabecera">
                <div>
                  <span className="eyebrow">TRAZABILIDAD</span>
                  <h2>Lotes y existencias</h2>
                  <p>Los lotes nuevos ingresan RETENIDOS y conservan existencias por ubicación.</p>
                </div>
                <Modal boton="Nuevo lote" titulo="Registrar lote e ingreso inicial" descripcion="El ingreso inicial se registra en Producción y Almacenamiento.">
                  <form action={registrarLote} className="formulario formulario-modal">
                    <input type="hidden" name="operacionClave" value={randomUUID()} />
                    <div className="form-grid">
                      <label className="campo">Producto<select name="productoId" required defaultValue=""><option value="" disabled>Selecciona un producto</option>{itemsProductos.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}</select></label>
                      <label className="campo">Código de lote<input name="codigo" minLength={2} maxLength={60} required placeholder="LT-2026-001" /></label>
                      <label className="campo">Fecha de elaboración<input name="elaboradoEl" type="date" required /></label>
                      <label className="campo">Fecha de vencimiento<input name="venceEl" type="date" required /></label>
                      <label className="campo">Cantidad inicial<input name="cantidadInicial" type="number" min={1} step={1} required /></label>
                      <label className="campo">Ubicación inicial<input value="Producción y Almacenamiento" readOnly aria-label="Ubicación inicial" /></label>
                    </div>
                    <div className="modal-acciones"><button type="submit" className="boton boton-primario" disabled={itemsProductos.length === 0}>Guardar lote e ingreso</button></div>
                  </form>
                </Modal>
              </div>

              {lotes.estado !== 200 ? (
                <div className="estado-vacio estado-error"><Icono nombre="alerta" /><p>No se pudo consultar la lista de lotes (HTTP {lotes.estado}).</p></div>
              ) : (
                <div className="tabla-contenedor">
                  <table>
                    <thead><tr><th>Lote</th><th>Condición</th><th>Vencimiento</th><th>Existencia por ubicación</th></tr></thead>
                    <tbody>
                      {itemsLotes.length === 0 ? (
                        <tr><td colSpan={4}><div className="tabla-vacia">Todavía no hay lotes registrados.</div></td></tr>
                      ) : itemsLotes.map((lote) => (
                        <tr key={lote.id}>
                          <td><span className="codigo">{lote.codigo}</span></td>
                          <td><span className={condicionClase(lote.condicion)}>{lote.condicion}</span></td>
                          <td>{lote.venceEl}</td>
                          <td>
                            <div className="saldos-inline">
                              {lote.existencias?.length ? lote.existencias.map((saldo) => (
                                <span key={saldo.codigo}><b>{saldo.codigo}</b><strong>{saldo.cantidad_fisica}</strong></span>
                              )) : <span>Sin existencias</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {vista === 'condiciones' && (
            <div className="modulo-dos-columnas">
              <section className="card card-modulo">
                <div className="card-cabecera">
                  <div><span className="eyebrow">CONDICIÓN COMERCIAL</span><h2>Decisiones sobre lotes</h2><p>Liberar o bloquear no cambia la existencia física.</p></div>
                  <Modal boton="Gestionar condición" titulo="Cambiar condición del lote" descripcion="La decisión quedará registrada con usuario, fecha y motivo.">
                    <form action={cambiarCondicionLote} className="formulario formulario-modal">
                      <input type="hidden" name="operacionClave" value={randomUUID()} />
                      <div className="form-grid form-grid-una">
                        <label className="campo">Lote<select name="loteId" required defaultValue=""><option value="" disabled>Selecciona un lote</option>{itemsLotes.map((l) => <option key={l.id} value={l.id}>{l.codigo} · {l.condicion}</option>)}</select></label>
                        <label className="campo">Acción<select name="accion" required defaultValue="liberar"><option value="liberar">Liberar para disponibilidad comercial</option><option value="bloquear">Bloquear lote</option></select></label>
                        <label className="campo">Motivo<input name="motivo" maxLength={250} required placeholder="Motivo de la decisión" /></label>
                      </div>
                      <div className="modal-acciones"><button type="submit" className="boton boton-primario" disabled={itemsLotes.length === 0}>Guardar condición</button></div>
                    </form>
                  </Modal>
                </div>

                <div className="condiciones-lista">
                  {itemsLotes.length === 0 ? <div className="estado-vacio"><p>No hay lotes registrados.</p></div> : itemsLotes.map((lote) => (
                    <div className="condicion-fila" key={lote.id}>
                      <div><strong>{lote.codigo}</strong><span>Vence {lote.venceEl}</span></div>
                      <span className={condicionClase(lote.condicion)}>{lote.condicion}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card card-modulo">
                <div className="card-cabecera card-cabecera-vertical">
                  <div><span className="eyebrow">AUDITORÍA</span><h2>Historial de condición</h2></div>
                  <form method="get" className="filtro-inline">
                    <input type="hidden" name="vista" value="condiciones" />
                    <select name="historialCondicionLoteId" defaultValue={parametros.historialCondicionLoteId ?? ''} required aria-label="Ver historial de condición">
                      <option value="" disabled>Selecciona un lote</option>
                      {itemsLotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.codigo}</option>)}
                    </select>
                    <button type="submit" className="boton boton-secundario">Consultar</button>
                  </form>
                </div>

                {!parametros.historialCondicionLoteId ? (
                  <div className="estado-vacio compacto"><span><Icono nombre="historial" /></span><p>Selecciona un lote para revisar sus cambios de condición.</p></div>
                ) : condiciones?.estado !== 200 ? (
                  <div className="estado-vacio estado-error"><Icono nombre="alerta" /><p>No se pudo consultar el historial (HTTP {condiciones?.estado ?? '—'}).</p></div>
                ) : (
                  <div className="timeline">
                    {itemsCondiciones.length === 0 ? <div className="estado-vacio compacto"><p>El lote todavía no tiene cambios de condición.</p></div> : itemsCondiciones.map((evento) => (
                      <article className="timeline-item" key={evento.id}>
                        <span className="timeline-punto" />
                        <div>
                          <div className="timeline-superior"><strong>{loteHistorialCondicion?.codigo ?? 'Lote'}</strong><time>{fechaBolivia(evento.creadoEn)}</time></div>
                          <p><span className={condicionClase(evento.condicionAnterior)}>{evento.condicionAnterior}</span><b>→</b><span className={condicionClase(evento.condicionNueva)}>{evento.condicionNueva}</span></p>
                          <small>{evento.motivo} · {evento.usuario.identificador}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {vista === 'movimientos' && (
            <section className="card card-modulo">
              <div className="card-cabecera">
                <div><span className="eyebrow">MOVIMIENTOS DE INVENTARIO</span><h2>Traslados e historial</h2><p>El traslado mueve existencia física sin modificar la condición del lote.</p></div>
                <Modal boton="Nuevo traslado" titulo="Registrar traslado" descripcion="Mueve unidades entre ubicaciones físicas manteniendo trazabilidad.">
                  <form action={registrarTraslado} className="formulario formulario-modal">
                    <input type="hidden" name="operacionClave" value={randomUUID()} />
                    <div className="form-grid">
                      <label className="campo">Lote a trasladar<select name="loteId" required defaultValue=""><option value="" disabled>Selecciona un lote</option>{itemsLotes.map((l) => <option key={l.id} value={l.id}>{l.codigo} · {l.condicion}</option>)}</select></label>
                      <label className="campo">Cantidad<input name="cantidad" type="number" min={1} step={1} required /></label>
                      <label className="campo">Origen<select name="origenCodigo" required defaultValue="PRODUCCION_ALMACENAMIENTO"><option value="PRODUCCION_ALMACENAMIENTO">Producción y Almacenamiento</option><option value="VENTA_DESPACHO">Venta y Despacho</option></select></label>
                      <label className="campo">Destino<select name="destinoCodigo" required defaultValue="VENTA_DESPACHO"><option value="VENTA_DESPACHO">Venta y Despacho</option><option value="PRODUCCION_ALMACENAMIENTO">Producción y Almacenamiento</option></select></label>
                      <label className="campo">Referencia <span className="opcional">Opcional</span><input name="referencia" maxLength={80} placeholder="Ej. TR-001" /></label>
                      <label className="campo">Motivo <span className="opcional">Opcional</span><input name="motivo" maxLength={250} placeholder="Motivo del movimiento" /></label>
                    </div>
                    <div className="modal-acciones"><button type="submit" className="boton boton-primario" disabled={itemsLotes.length === 0}>Guardar traslado</button></div>
                  </form>
                </Modal>
              </div>

              <div className="barra-filtros">
                <div><Icono nombre="historial" tamano={17} /><span>Historial por lote</span></div>
                <form method="get" className="filtro-inline">
                  <input type="hidden" name="vista" value="movimientos" />
                  <select name="historialLoteId" defaultValue={parametros.historialLoteId ?? ''} required aria-label="Ver historial del lote">
                    <option value="" disabled>Selecciona un lote</option>
                    {itemsLotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.codigo}</option>)}
                  </select>
                  <button type="submit" className="boton boton-secundario">Consultar</button>
                </form>
              </div>

              {!parametros.historialLoteId ? (
                <div className="estado-vacio"><span><Icono nombre="movimiento" tamano={25} /></span><h3>Consulta el recorrido de un lote</h3><p>Selecciona un lote para ver ingresos y traslados registrados.</p></div>
              ) : movimientos?.estado !== 200 ? (
                <div className="estado-vacio estado-error"><Icono nombre="alerta" /><p>No se pudo consultar el historial (HTTP {movimientos?.estado ?? '—'}).</p></div>
              ) : (
                <div className="tabla-contenedor">
                  <table>
                    <thead><tr><th>Fecha</th><th>Lote</th><th>Movimiento</th><th>Origen</th><th>Destino</th><th>Cantidad</th><th>Usuario</th></tr></thead>
                    <tbody>
                      {itemsMovimientos.length === 0 ? (
                        <tr><td colSpan={7}><div className="tabla-vacia">El lote no tiene movimientos.</div></td></tr>
                      ) : itemsMovimientos.map((movimiento) => (
                        <tr key={movimiento.id}>
                          <td>{fechaBolivia(movimiento.creadoEn)}</td>
                          <td><span className="codigo">{loteHistorial?.codigo ?? '—'}</span></td>
                          <td><span className="badge badge-azul">{movimiento.tipo}</span></td>
                          <td>{movimiento.origen?.nombre ?? '—'}</td>
                          <td>{movimiento.destino?.nombre ?? '—'}</td>
                          <td><strong>{movimiento.cantidad}</strong></td>
                          <td>{movimiento.usuario.identificador}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

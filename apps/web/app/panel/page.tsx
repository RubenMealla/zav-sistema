import { MarcoPanel, vistas, type Vista } from './marco-panel';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { Icono } from '../componentes/icono';
import { MapaUbicacion } from '../componentes/mapa-ubicacion';
import { BotonEnviar, Modal, Notificacion } from '../componentes/interacciones';
import {
  cambiarCondicionLote,
  configurarGeorreferenciaDespacho,
  registrarLote,
  registrarProducto,
  registrarTraslado,
} from './acciones';
import { AccionesProducto } from './acciones-producto';
import { Paginacion } from '../componentes/paginacion';

const API = process.env.API_BASE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://zav-api-2026.onrender.com' : 'http://localhost:3001');
const LIMITES_TABLA = [10, 20, 30, 50, 100, 150] as const;
function limiteSeguro(valor: string | undefined) {
  const numero = Number.parseInt(valor ?? '20', 10);
  return LIMITES_TABLA.includes(numero as (typeof LIMITES_TABLA)[number]) ? numero : 20;
}

function paginaSegura(valor: string | undefined) {
  const numero = Number.parseInt(valor ?? '1', 10);
  return Number.isFinite(numero) && numero > 0 ? numero : 1;
}

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
type PedidoAuditoria = {
  id: string;
  estado: 'REGISTRADO' | 'EN_DISTRIBUCION' | 'ENTREGADO' | 'CANCELADO';
  direccionEntrega: string;
  creadoEn: string;
  retiradoEn: string | null;
  entregadoEn: string | null;
  cliente: { id: string; nombre: string };
  vendedor: { id: string; nombre: string; identificador: string };
  unidades: number;
  totalBob: string;
};
type VentaDespacho = {
  id: string;
  codigo: string;
  nombre: string;
  clase: string;
  ubicacion: { latitud: number; longitud: number } | null;
};
const mensajes: Record<string, string> = {
  codigo: 'Ya existe un producto con ese código.',
  'lote-duplicado': 'El código de lote o la clave de operación ya está registrado.',
  'traslado-conflicto': 'No se pudo trasladar. Revisa el saldo disponible.',
  'condicion-conflicto': 'No se pudo cambiar la condición. Revisa estado, vigencia y producto.',
  conexion: 'No se pudo conectar con la API de ZAV.',
  producto: 'No se registró el producto. Revisa los datos.',
  'producto-edicion': 'No se pudo actualizar el producto. Revisa los datos.',
  'producto-baja': 'No se pudo desactivar el producto.',
  lote: 'No se registró el lote. Comprueba fechas, ubicación y cantidad.',
  traslado: 'No se registró el traslado. Revisa lote, ubicaciones y cantidad.',
  condicion: 'No se cambió la condición del lote. Revisa los datos.',
  'despacho-geo': 'No se pudo guardar la ubicación geográfica de Venta y Despacho.',
};

const mensajesOk: Record<string, string> = {
  producto: 'Producto registrado correctamente.',
  'producto-editado': 'Producto actualizado correctamente.',
  'producto-baja': 'Producto desactivado correctamente.',
  lote: 'Lote e ingreso inicial registrados correctamente.',
  traslado: 'Traslado registrado correctamente.',
  condicion: 'Condición del lote actualizada correctamente.',
  'despacho-geo': 'Ubicación geográfica de Venta y Despacho actualizada.',
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
    productoQ?: string;
    productoActivo?: string;
    loteProductoId?: string;
    loteVigencia?: string;
    pedidoEstado?: string;
    productoPagina?: string;
    lotePagina?: string;
    condicionPagina?: string;
    historialCondicionPagina?: string;
    pedidoPagina?: string;
    movimientoPagina?: string;
    limite?: string;
    pedidoQ?: string;
    pedidoDesde?: string;
    pedidoHasta?: string;
  }>;
}) {
  const token = (await cookies()).get('zav_acceso')?.value;
  if (!token) redirect('/acceso?error=sesion');

  const parametros = await searchParams;
  const vista: Vista = parametros.vista && parametros.vista in vistas ? parametros.vista as Vista : 'resumen';
  const productoPagina = paginaSegura(parametros.productoPagina);
  const lotePagina = paginaSegura(parametros.lotePagina);
  const condicionPagina = paginaSegura(parametros.condicionPagina);
  const historialCondicionPagina = paginaSegura(parametros.historialCondicionPagina);
  const pedidoPagina = paginaSegura(parametros.pedidoPagina);
  const movimientoPagina = paginaSegura(parametros.movimientoPagina);
  const limiteTabla = limiteSeguro(parametros.limite);

  const vacia = <T,>(): { estado: number; datos?: Pagina<T> } => ({
    estado: 200,
    datos: { items: [], total: 0 },
  });
  let perfil: { estado: number; datos?: Perfil };
  let productos = vacia<Producto>();
  let lotes = vacia<Lote>();
  let movimientos: { estado: number; datos?: Pagina<Movimiento> } | undefined;
  let condiciones: { estado: number; datos?: Pagina<EventoCondicion> } | undefined;
  let ventaDespacho: { estado: number; datos?: VentaDespacho } | undefined;
  let pedidos = vacia<PedidoAuditoria>();

  try {
    const necesitaProductos = vista === 'resumen' || vista === 'productos' || vista === 'lotes';
    const necesitaLotes = vista !== 'productos';

    const productoParametros = new URLSearchParams({ limit: vista === 'productos' ? String(limiteTabla) : '100' });
    if (vista === 'productos') productoParametros.set('page', String(productoPagina));
    if (vista === 'productos' && parametros.productoQ?.trim()) {
      productoParametros.set('q', parametros.productoQ.trim());
    }
    if (vista === 'productos' && parametros.productoActivo && ['true', 'false'].includes(parametros.productoActivo)) {
      productoParametros.set('activo', parametros.productoActivo);
    }

    const loteParametros = new URLSearchParams({
      limit: vista === 'lotes' || vista === 'condiciones' ? String(limiteTabla) : '50',
    });
    if (vista === 'lotes') loteParametros.set('page', String(lotePagina));
    if (vista === 'condiciones') loteParametros.set('page', String(condicionPagina));
    if (vista === 'lotes' && parametros.loteProductoId) loteParametros.set('productoId', parametros.loteProductoId);
    if (vista === 'lotes' && parametros.loteVigencia && ['vigente', 'vencido'].includes(parametros.loteVigencia)) {
      loteParametros.set('vigencia', parametros.loteVigencia);
    }

    const [
      respuestaPerfil,
      respuestaProductos,
      respuestaLotes,
      respuestaMovimientos,
      respuestaCondiciones,
      respuestaVentaDespacho,
    ] = await Promise.all([
        consultar<Perfil>('/api/v1/auth/me', token),
        necesitaProductos
          ? consultar<Pagina<Producto>>(`/api/v1/productos?${productoParametros.toString()}`, token)
          : Promise.resolve(vacia<Producto>()),
        necesitaLotes
          ? consultar<Pagina<Lote>>(`/api/v1/lotes?${loteParametros.toString()}`, token)
          : Promise.resolve(vacia<Lote>()),
        vista === 'movimientos' && parametros.historialLoteId
          ? consultar<Pagina<Movimiento>>(
              `/api/v1/movimientos?loteId=${encodeURIComponent(parametros.historialLoteId)}&page=${movimientoPagina}&limit=${limiteTabla}`,
              token,
            )
          : Promise.resolve(undefined),
        vista === 'condiciones' && parametros.historialCondicionLoteId
          ? consultar<Pagina<EventoCondicion>>(
              `/api/v1/lotes/${encodeURIComponent(parametros.historialCondicionLoteId)}/condiciones?page=${historialCondicionPagina}&limit=${limiteTabla}`,
              token,
            )
          : Promise.resolve(undefined),
        vista === 'distribucion'
          ? consultar<VentaDespacho>('/api/v1/ubicaciones/venta-despacho', token)
          : Promise.resolve(undefined),
      ]);

    perfil = respuestaPerfil;
    productos = respuestaProductos;
    lotes = respuestaLotes;
    movimientos = respuestaMovimientos;
    condiciones = respuestaCondiciones;
    ventaDespacho = respuestaVentaDespacho;
    if (vista === 'pedidos') {
      const pedidoParametros = new URLSearchParams({ page: String(pedidoPagina), limit: String(limiteTabla) });
      if (parametros.pedidoEstado && ['REGISTRADO', 'EN_DISTRIBUCION', 'ENTREGADO', 'CANCELADO'].includes(parametros.pedidoEstado)) {
        pedidoParametros.set('estado', parametros.pedidoEstado);
      }
      if (parametros.pedidoQ?.trim()) pedidoParametros.set('q', parametros.pedidoQ.trim());
      if (parametros.pedidoDesde) pedidoParametros.set('desde', parametros.pedidoDesde);
      if (parametros.pedidoHasta) pedidoParametros.set('hasta', parametros.pedidoHasta);
      pedidos = await consultar<Pagina<PedidoAuditoria>>(`/api/v1/admin/pedidos?${pedidoParametros.toString()}`, token);
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
  const itemsPedidos = pedidos.datos?.items ?? [];
  const loteHistorial = itemsLotes.find((lote) => lote.id === parametros.historialLoteId);
  const loteHistorialCondicion = itemsLotes.find((lote) => lote.id === parametros.historialCondicionLoteId);
  const lotesLiberados = itemsLotes.filter((lote) => lote.condicion === 'LIBERADO').length;
  const lotesRetenidos = itemsLotes.filter((lote) => lote.condicion === 'RETENIDO').length;
  const lotesBloqueados = itemsLotes.filter((lote) => lote.condicion === 'BLOQUEADO').length;
  const totalFisico = itemsLotes.reduce(
    (total, lote) => total + (lote.existencias ?? []).reduce((subtotal, saldo) => subtotal + saldo.cantidad_fisica, 0),
    0,
  );

  return (
    <MarcoPanel vista={vista} perfil={perfil.datos}>
        {parametros.mensaje && <Notificacion key={`${parametros.mensaje ?? parametros.error}-${randomUUID()}`} tipo="exito" mensaje={mensajesOk[parametros.mensaje] ?? 'Operación registrada correctamente.'} />}
        {parametros.error && <Notificacion key={`${parametros.mensaje ?? parametros.error}-${randomUUID()}`} tipo="error" mensaje={mensajes[parametros.error] ?? 'No se pudo completar la operación.'} />}

        <div className={`vista-contenido vista-${vista}`}>
          {vista === 'resumen' && (
            <>
              <section className="bienvenida">
                <div><span className="eyebrow">CONTROL INTERNO / ZAV</span><h2>Inventario bajo seguimiento</h2><p>Hola, {perfil.datos.nombre.split(' ')[0]}. Consulta las existencias y continúa con tu trabajo.</p></div>
                <span className="bienvenida-sello">PRODUCTOS<br />TERMINADOS</span>
              </section>

              <section className="metricas-grid" aria-label="Resumen del inventario">
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
                  <div><span>Liberados</span><strong>{lotes.estado === 200 ? lotesLiberados : "—"}</strong><small>En los lotes consultados</small></div>
                </article>
                <article className="metrica-card">
                  <span className="metrica-icono"><Icono nombre="ubicacion" /></span>
                  <div><span>Existencia física</span><strong>{lotes.estado === 200 ? totalFisico : "—"}</strong><small>En los lotes consultados</small></div>
                </article>
              </section>

              <p className="alcance-datos">Lotes consultados: {itemsLotes.length} (máximo 30), base del cálculo de condiciones y existencia física. Los totales de productos y lotes corresponden al registro completo.</p>
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
                    <Link href="/panel?vista=pedidos" className="acceso-rapido"><span><Icono nombre="historial" /></span><div><strong>Pedidos</strong><p>Revisa operaciones y vendedor responsable.</p></div><b>→</b></Link>
                    <Link href="/panel?vista=distribucion" className="acceso-rapido"><span><Icono nombre="ubicacion" /></span><div><strong>Distribución</strong><p>Configura el punto de salida para reparto.</p></div><b>→</b></Link>
                  </div>
                </section>

                <section className="card estado-card">
                  <div className="card-cabecera"><div><span className="eyebrow">CONDICIÓN DE LOTES</span><h2>Condición actual</h2></div></div>
                  <div className="estado-resumen">
                    <div><span className="punto-estado punto-verde" /><span>Liberados</span><strong>{lotes.estado === 200 ? lotesLiberados : "—"}</strong></div>
                    <div><span className="punto-estado punto-ambar" /><span>Retenidos</span><strong>{lotes.estado === 200 ? lotesRetenidos : "—"}</strong></div>
                    <div><span className="punto-estado punto-rojo" /><span>Bloqueados</span><strong>{lotes.estado === 200 ? lotesBloqueados : "—"}</strong></div>
                  </div>
                  <p className="nota-card"><Icono nombre="escudo" tamano={15} /> La condición comercial es independiente de la ubicación física.</p>
                </section>
              </div>

            </>
          )}


          {vista === 'distribucion' && (
            <section className="card card-modulo card-distribucion">
              <div className="card-cabecera">
                <div>
                  <span className="eyebrow">CONFIGURACIÓN DE REPARTO</span>
                  <h2>Ubicación de salida</h2>
                  <p>Marca en el mapa el punto habitual desde donde inicia la distribución. El sistema guarda el marcador y lo muestra nuevamente en cada ingreso.</p>
                </div>
              </div>
              {ventaDespacho?.estado !== 200 || !ventaDespacho.datos ? (
                <div className="estado-vacio estado-error"><Icono nombre="alerta" /><p>No se pudo consultar la ubicación de salida para reparto.</p></div>
              ) : (
                <form action={configurarGeorreferenciaDespacho} className="formulario formulario-mapa">
                  <input type="hidden" name="ubicacionId" value={ventaDespacho.datos.id} />
                  <MapaUbicacion latitud={ventaDespacho.datos.ubicacion?.latitud ?? null} longitud={ventaDespacho.datos.ubicacion?.longitud ?? null} />
                </form>
              )}
            </section>
          )}

          {vista === 'productos' && (
            <section className="card card-modulo">
              <div className="card-cabecera">
                <div>
                  <span className="eyebrow">CATÁLOGO INTERNO</span>
                  <h2>Productos registrados</h2>
                  <p>Registros disponibles para consulta administrativa: {productos.datos?.total ?? '—'}.</p>
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
                    <div className="modal-acciones"><BotonEnviar>Guardar producto</BotonEnviar></div>
                  </form>
                </Modal>
              </div>

              <form method="get" className="barra-filtros filtros-principales">
                <input type="hidden" name="vista" value="productos" />
                <label className="filtro-campo filtro-busqueda">
                  <span>Buscar</span>
                  <input name="productoQ" defaultValue={parametros.productoQ ?? ''} placeholder="Código o nombre del producto" />
                </label>
                <label className="filtro-campo">
                  <span>Estado</span>
                  <select name="productoActivo" defaultValue={parametros.productoActivo ?? ''}>
                    <option value="">Todos</option>
                    <option value="true">Activos</option>
                    <option value="false">Inactivos</option>
                  </select>
                </label>
                <div className="filtros-acciones">
                  <button type="submit" className="boton boton-secundario">Aplicar filtros</button>
                  <Link className="boton boton-terciario" href="/panel?vista=productos">Limpiar</Link>
                </div>
              </form>

              {productos.estado !== 200 ? (
                <div className="estado-vacio estado-error"><Icono nombre="alerta" /><p>No se pudo consultar la lista de productos (HTTP {productos.estado}).</p></div>
              ) : (
                <div className="tabla-contenedor" role="region" tabIndex={0} aria-label="Productos registrados; tabla desplazable">
                  <table><caption className="solo-lectores">Productos registrados</caption>
                    <thead><tr><th scope="col">Código</th><th scope="col">Producto</th><th scope="col">Familia</th><th scope="col">Presentación</th><th scope="col" className="numero">Peso</th><th scope="col" className="numero">Precio</th><th scope="col">Estado</th><th scope="col" className="acciones-columna">Acciones</th></tr></thead>
                    <tbody>
                      {itemsProductos.length === 0 ? (
                        <tr><td colSpan={8}><div className="tabla-vacia"><strong>Todavía no hay productos registrados.</strong><span>Usa «Nuevo producto» para registrar la primera presentación.</span></div></td></tr>
                      ) : itemsProductos.map((producto) => (
                        <tr key={producto.id}>
                          <td><span className="codigo">{producto.codigo}</span></td>
                          <td><strong>{producto.nombre}</strong></td>
                          <td>{producto.familia}</td>
                          <td>{producto.presentacion}</td>
                          <td className="numero">{producto.pesoGramos} g</td>
                          <td className="numero"><strong>Bs {producto.precioBob}</strong></td>
                          <td><span className={producto.activo ? 'badge badge-verde' : 'badge badge-neutro'}>{producto.activo ? 'ACTIVO' : 'INACTIVO'}</span></td>
                          <td className="acciones-columna"><AccionesProducto producto={producto} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Paginacion pagina={productoPagina} total={productos.datos?.total ?? 0} limite={limiteTabla} parametro="productoPagina" parametros={{ vista: 'productos', productoQ: parametros.productoQ, productoActivo: parametros.productoActivo }} />
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
                    <div className="modal-acciones"><BotonEnviar disabled={itemsProductos.length === 0}>Guardar lote e ingreso</BotonEnviar></div>
                  </form>
                </Modal>
              </div>

              <form method="get" className="barra-filtros filtros-principales">
                <input type="hidden" name="vista" value="lotes" />
                <label className="filtro-campo filtro-busqueda">
                  <span>Producto</span>
                  <select name="loteProductoId" defaultValue={parametros.loteProductoId ?? ''}>
                    <option value="">Todos los productos</option>
                    {itemsProductos.map((producto) => (
                      <option key={producto.id} value={producto.id}>{producto.codigo} · {producto.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="filtro-campo">
                  <span>Vigencia</span>
                  <select name="loteVigencia" defaultValue={parametros.loteVigencia ?? ''}>
                    <option value="">Todos</option>
                    <option value="vigente">Vigentes</option>
                    <option value="vencido">Vencidos</option>
                  </select>
                </label>
                <div className="filtros-acciones">
                  <button type="submit" className="boton boton-secundario">Aplicar filtros</button>
                  <Link className="boton boton-terciario" href="/panel?vista=lotes">Limpiar</Link>
                </div>
              </form>

              {lotes.estado !== 200 ? (
                <div className="estado-vacio estado-error"><Icono nombre="alerta" /><p>No se pudo consultar la lista de lotes (HTTP {lotes.estado}).</p></div>
              ) : (
                <div className="tabla-contenedor" role="region" tabIndex={0} aria-label="Lotes y existencias; tabla desplazable">
                  <table><caption className="solo-lectores">Lotes y existencias</caption>
                    <thead><tr><th scope="col">Lote</th><th scope="col">Condición</th><th scope="col">Vencimiento</th><th scope="col">Existencia por ubicación</th><th scope="col" className="acciones-columna">Acciones</th></tr></thead>
                    <tbody>
                      {itemsLotes.length === 0 ? (
                        <tr><td colSpan={5}><div className="tabla-vacia"><strong>Todavía no hay lotes registrados.</strong><span>Registra un producto y luego su lote e ingreso inicial.</span></div></td></tr>
                      ) : itemsLotes.map((lote) => (
                        <tr key={lote.id}>
                          <td><span className="codigo">{lote.codigo}</span></td>
                          <td><span className={condicionClase(lote.condicion)}>{lote.condicion}</span></td>
                          <td>{lote.venceEl}</td>
                          <td>
                            <div className="saldos-inline">
                              {lote.existencias?.length ? lote.existencias.map((saldo) => (
                                <span key={saldo.codigo}><b>{saldo.codigo === "PRODUCCION_ALMACENAMIENTO" ? "Producción y Almacenamiento" : saldo.codigo === "VENTA_DESPACHO" ? "Venta y Despacho" : saldo.codigo}</b><strong>{saldo.cantidad_fisica}</strong></span>
                              )) : <span>Sin existencias</span>}
                            </div>
                          </td>
                          <td className="acciones-columna">
                            <Modal boton="Detalles" titulo="Detalle del lote" etiqueta="LOTE" variante="terciaria" icono="historial">
                              <dl className="detalle-grid">
                                <div><dt>Código</dt><dd><span className="codigo">{lote.codigo}</span></dd></div>
                                <div><dt>Condición</dt><dd><span className={condicionClase(lote.condicion)}>{lote.condicion}</span></dd></div>
                                <div><dt>Vencimiento</dt><dd>{lote.venceEl}</dd></div>
                                <div className="detalle-ancho"><dt>Existencias</dt><dd>{(lote.existencias ?? []).map((saldo) => `${saldo.codigo}: ${saldo.cantidad_fisica}`).join(' · ') || 'Sin existencias'}</dd></div>
                              </dl>
                            </Modal>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Paginacion pagina={lotePagina} total={lotes.datos?.total ?? 0} limite={limiteTabla} parametro="lotePagina" parametros={{ vista: 'lotes', loteProductoId: parametros.loteProductoId, loteVigencia: parametros.loteVigencia }} />
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
                      <div className="modal-acciones"><BotonEnviar disabled={itemsLotes.length === 0}>Guardar condición</BotonEnviar></div>
                    </form>
                  </Modal>
                </div>

                <div className="condiciones-lista">
                  {itemsLotes.length === 0 ? <div className="estado-vacio"><p>No hay lotes registrados.</p></div> : itemsLotes.map((lote) => (
                    <div className="condicion-fila" key={lote.id}>
                      <div><strong>{lote.codigo}</strong><span>Vence {lote.venceEl}</span></div>
                      <div className="condicion-fila-acciones">
                        <span className={condicionClase(lote.condicion)}>{lote.condicion}</span>
                        <Modal boton="Detalles" titulo="Detalle de condición" etiqueta="LOTE" variante="terciaria" icono="historial">
                          <dl className="detalle-grid">
                            <div><dt>Lote</dt><dd><span className="codigo">{lote.codigo}</span></dd></div>
                            <div><dt>Condición</dt><dd><span className={condicionClase(lote.condicion)}>{lote.condicion}</span></dd></div>
                            <div><dt>Vencimiento</dt><dd>{lote.venceEl}</dd></div>
                            <div className="detalle-ancho"><dt>Existencias</dt><dd>{(lote.existencias ?? []).map((saldo) => `${saldo.codigo}: ${saldo.cantidad_fisica}`).join(' · ') || 'Sin existencias'}</dd></div>
                          </dl>
                        </Modal>
                      </div>
                    </div>
                  ))}
                </div>
                <Paginacion pagina={condicionPagina} total={lotes.datos?.total ?? 0} limite={limiteTabla} parametro="condicionPagina" parametros={{ vista: 'condiciones', historialCondicionLoteId: parametros.historialCondicionLoteId }} />
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
                <Paginacion pagina={historialCondicionPagina} total={condiciones?.datos?.total ?? 0} limite={limiteTabla} parametro="historialCondicionPagina" parametros={{ vista: 'condiciones', historialCondicionLoteId: parametros.historialCondicionLoteId, condicionPagina: parametros.condicionPagina }} />
              </section>
            </div>
          )}

          {vista === 'pedidos' && (
            <section className="card card-modulo">
              <div className="card-cabecera">
                <div>
                  <span className="eyebrow">AUDITORÍA COMERCIAL</span>
                  <h2>Pedidos registrados</h2>
                  <p>Cada pedido conserva el Vendedor autenticado que lo registró y sus cambios de estado.</p>
                </div>
              </div>

              <form method="get" className="barra-filtros filtros-principales filtros-pedidos">
                <input type="hidden" name="vista" value="pedidos" />
                <label className="filtro-campo filtro-busqueda">
                  <span>Buscar</span>
                  <input name="pedidoQ" defaultValue={parametros.pedidoQ ?? ''} placeholder="Cliente, vendedor o destino" />
                </label>
                <label className="filtro-campo">
                  <span>Estado</span>
                  <select name="pedidoEstado" defaultValue={parametros.pedidoEstado ?? ''}>
                    <option value="">Todos</option>
                    <option value="REGISTRADO">Registrado</option>
                    <option value="EN_DISTRIBUCION">En distribución</option>
                    <option value="ENTREGADO">Entregado</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </label>
                <label className="filtro-campo">
                  <span>Desde</span>
                  <input type="date" name="pedidoDesde" defaultValue={parametros.pedidoDesde ?? ''} />
                </label>
                <label className="filtro-campo">
                  <span>Hasta</span>
                  <input type="date" name="pedidoHasta" defaultValue={parametros.pedidoHasta ?? ''} />
                </label>
                <div className="filtros-acciones">
                  <button type="submit" className="boton boton-secundario">Aplicar filtro</button>
                  <Link className="boton boton-terciario" href="/panel?vista=pedidos">Limpiar</Link>
                </div>
              </form>

              {pedidos.estado !== 200 ? (
                <div className="estado-vacio estado-error">
                  <Icono nombre="alerta" />
                  <p>No se pudo consultar la auditoría de pedidos (HTTP {pedidos.estado}).</p>
                </div>
              ) : (
                <>
                  <div className="tabla-contenedor" role="region" tabIndex={0} aria-label="Pedidos registrados; tabla desplazable">
                    <table>
                      <caption className="solo-lectores">Auditoría de pedidos</caption>
                      <thead>
                        <tr>
                          <th scope="col">Fecha</th>
                          <th scope="col">Cliente</th>
                          <th scope="col">Vendedor</th>
                          <th scope="col">Estado</th>
                          <th scope="col" className="numero">Unidades</th>
                          <th scope="col" className="numero">Total</th>
                          <th scope="col">Destino</th>
                          <th scope="col" className="acciones-columna">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsPedidos.length === 0 ? (
                          <tr>
                            <td colSpan={8}>
                              <div className="tabla-vacia">Todavía no hay pedidos registrados.</div>
                            </td>
                          </tr>
                        ) : itemsPedidos.map((pedido) => (
                          <tr key={pedido.id}>
                            <td className="dato-nowrap">
                              <time dateTime={pedido.creadoEn}>{fechaBolivia(pedido.creadoEn)}</time>
                            </td>
                            <td><strong>{pedido.cliente.nombre}</strong></td>
                            <td>
                              <strong>{pedido.vendedor.nombre}</strong>
                              <br />
                              <small>{pedido.vendedor.identificador}</small>
                            </td>
                            <td>
                              <span className={
                                pedido.estado === 'ENTREGADO'
                                  ? 'badge badge-verde'
                                  : pedido.estado === 'CANCELADO'
                                    ? 'badge badge-rojo'
                                    : pedido.estado === 'EN_DISTRIBUCION'
                                      ? 'badge badge-azul'
                                      : 'badge badge-ambar'
                              }>
                                {pedido.estado === 'EN_DISTRIBUCION' ? 'EN DISTRIBUCIÓN' : pedido.estado}
                              </span>
                            </td>
                            <td className="numero"><strong>{pedido.unidades}</strong></td>
                            <td className="numero"><strong>Bs {pedido.totalBob}</strong></td>
                            <td>{pedido.direccionEntrega}</td>
                            <td className="acciones-columna">
                              <Modal boton="Detalles" titulo="Detalle del pedido" etiqueta="PEDIDO" variante="terciaria" icono="historial" amplio>
                                <dl className="detalle-grid">
                                  <div><dt>Fecha</dt><dd>{fechaBolivia(pedido.creadoEn)}</dd></div>
                                  <div><dt>Estado</dt><dd><span className="badge badge-neutro">{pedido.estado}</span></dd></div>
                                  <div><dt>Cliente</dt><dd>{pedido.cliente.nombre}</dd></div>
                                  <div><dt>Vendedor</dt><dd>{pedido.vendedor.nombre} · {pedido.vendedor.identificador}</dd></div>
                                  <div><dt>Unidades</dt><dd>{pedido.unidades}</dd></div>
                                  <div><dt>Total</dt><dd>Bs {pedido.totalBob}</dd></div>
                                  <div className="detalle-ancho"><dt>Destino</dt><dd>{pedido.direccionEntrega}</dd></div>
                                </dl>
                              </Modal>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Paginacion pagina={pedidoPagina} total={pedidos.datos?.total ?? 0} limite={limiteTabla} parametro="pedidoPagina" parametros={{ vista: 'pedidos', pedidoEstado: parametros.pedidoEstado, pedidoQ: parametros.pedidoQ, pedidoDesde: parametros.pedidoDesde, pedidoHasta: parametros.pedidoHasta }} />
                </>
              )}
            </section>
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
                    <div className="modal-acciones"><BotonEnviar disabled={itemsLotes.length === 0}>Guardar traslado</BotonEnviar></div>
                  </form>
                </Modal>
              </div>

              <div className="barra-filtros barra-historial">
                <div className="historial-etiqueta"><Icono nombre="historial" tamano={19} /><span>Historial por lote</span></div>
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
                <div className="tabla-contenedor" role="region" tabIndex={0} aria-label="Movimientos del lote; tabla desplazable">
                  <table><caption className="solo-lectores">Movimientos del lote</caption>
                    <thead><tr><th scope="col">Fecha</th><th scope="col">Lote</th><th scope="col">Movimiento</th><th scope="col">Origen</th><th scope="col">Destino</th><th scope="col">Cantidad</th><th scope="col">Usuario</th><th scope="col" className="acciones-columna">Acciones</th></tr></thead>
                    <tbody>
                      {itemsMovimientos.length === 0 ? (
                        <tr><td colSpan={8}><div className="tabla-vacia">El lote no tiene movimientos.</div></td></tr>
                      ) : itemsMovimientos.map((movimiento) => (
                        <tr key={movimiento.id}>
                          <td className="dato-nowrap"><time dateTime={movimiento.creadoEn}>{fechaBolivia(movimiento.creadoEn)}</time></td>
                          <td><span className="codigo">{loteHistorial?.codigo ?? '—'}</span></td>
                          <td><span className="badge badge-azul">{movimiento.tipo}</span></td>
                          <td>{movimiento.origen?.nombre ?? '—'}</td>
                          <td>{movimiento.destino?.nombre ?? '—'}</td>
                          <td className="numero"><strong>{movimiento.cantidad}</strong></td>
                          <td className="dato-nowrap">{movimiento.usuario.identificador}</td>
                          <td className="acciones-columna">
                            <Modal boton="Detalles" titulo="Detalle del movimiento" etiqueta="MOVIMIENTO" variante="terciaria" icono="historial">
                              <dl className="detalle-grid">
                                <div><dt>Fecha</dt><dd>{fechaBolivia(movimiento.creadoEn)}</dd></div>
                                <div><dt>Tipo</dt><dd><span className="badge badge-azul">{movimiento.tipo}</span></dd></div>
                                <div><dt>Origen</dt><dd>{movimiento.origen?.nombre ?? '—'}</dd></div>
                                <div><dt>Destino</dt><dd>{movimiento.destino?.nombre ?? '—'}</dd></div>
                                <div><dt>Cantidad</dt><dd>{movimiento.cantidad}</dd></div>
                                <div><dt>Usuario</dt><dd>{movimiento.usuario.identificador}</dd></div>
                                <div className="detalle-ancho"><dt>Referencia</dt><dd>{movimiento.referencia ?? 'Sin referencia'}</dd></div>
                              </dl>
                            </Modal>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Paginacion pagina={movimientoPagina} total={movimientos?.datos?.total ?? 0} limite={limiteTabla} parametro="movimientoPagina" parametros={{ vista: 'movimientos', historialLoteId: parametros.historialLoteId }} />
            </section>
          )}
        </div>
    </MarcoPanel>
  );
}

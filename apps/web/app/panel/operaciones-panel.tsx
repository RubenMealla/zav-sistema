"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Ventana } from "../componentes/ventana";
import { etiquetaOperacion, fechaOperacion } from "./lib/etiquetas-operaciones";
import { BotonEnviar } from "../componentes/interacciones";
import {
  manejarInvalido,
  limpiarInvalido,
} from "../componentes/validacion-formularios";
import { ErrorGestion, gestion, mensajeError } from "./lib/gestion-cliente";

type Disponible = {
  productoId: string;
  nombre: string;
  codigo: string;
  presentacion: string;
  cantidadDisponible: number;
  cantidadComprometida?: number;
};
type Operacion = {
  id: string;
  tipo: string;
  estado: string;
  creadoEn: string;
  responsable: string;
  vendedorNombre: string | null;
  unidades: number;
  reversionId: string | null;
};
type Detalle = Operacion & {
  operacionClave: string;
  latitud: string | null;
  longitud: string | null;
  precisionM: string | null;
  clienteNombre: string | null;
  motivo: string | null;
  detalles: {
    productoId: string;
    cantidad: number;
    precioUnitarioBob: string | null;
    productoHistorico: { nombre: string; codigo: string; presentacion: string };
    lotes: {
      loteId: string;
      codigo: string;
      cantidad: number;
      condicionAlRegistrar: string;
      movimientoId: string | null;
    }[];
  }[];
  eventos: { accion: string; responsable: string; creadoEn: string }[];
};
type Custodia = {
  vendedorId: string;
  vendedorNombre: string;
  loteId: string;
  loteCodigo: string;
  nombre: string;
  codigo: string;
  presentacion: string;
  finalidad: string;
  cantidad: number;
  libre: number;
  pendiente: number;
  condicion: string;
  venceEl: string;
};
const suscribirPendiente = (notificar: () => void) => {
  window.addEventListener("zav-operacion", notificar);
  window.addEventListener("storage", notificar);
  return () => {
    window.removeEventListener("zav-operacion", notificar);
    window.removeEventListener("storage", notificar);
  };
};
const snapshotServidor = () => undefined;
type Pendiente = {
  version: 1;
  ruta: string;
  datos: Record<string, unknown>;
  resumen: string;
};

export function OperacionesPanel({
  modo,
  usuario,
}: {
  modo: "venta-directa" | "custodia";
  usuario: string;
}) {
  const [vista, setVista] = useState<
    "nueva" | "inventario" | "devoluciones" | "historial"
  >("nueva");
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState("");
  const revisionDetalle = useRef(0);
  const revisionLista = useRef(0);
  const [comprobante, setComprobante] = useState<Detalle | null>(null);
  const [disponibles, setDisponibles] = useState<Disponible[]>([]);
  const [vendedores, setVendedores] = useState<
    { id: string; nombre: string }[]
  >([]);
  const [vendedor, setVendedor] = useState("");
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState("");
  const [historial, setHistorial] = useState<Operacion[]>([]);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [custodia, setCustodia] = useState<Custodia[]>([]);
  const [conciliado, setConciliado] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [custodiaPage, setCustodiaPage] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const almacenamiento = `zav.operacion.v1.${usuario}`;
  const bloqueo = useRef(false);
  const leerPendiente = useCallback((): string | null | undefined => {
    try {
      return localStorage.getItem(almacenamiento);
    } catch {
      return "almacenamiento-no-disponible";
    }
  }, [almacenamiento]);
  const guardado = useSyncExternalStore(
    suscribirPendiente,
    leerPendiente,
    snapshotServidor,
  );
  const { pendiente, errorAlmacenamiento } = useMemo(() => {
    try {
      const p = guardado ? (JSON.parse(guardado) as Pendiente) : null;
      if (p && (p.version !== 1 || !p.ruta.startsWith("operaciones/")))
        throw new Error();
      return { pendiente: p, errorAlmacenamiento: "" };
    } catch {
      return {
        pendiente: null,
        errorAlmacenamiento:
          "No se pudo recuperar la operación pendiente. Revisa el almacenamiento del navegador antes de continuar.",
      };
    }
  }, [guardado]);
  const lista = guardado !== undefined && !errorAlmacenamiento;
  function persistir(p: Pendiente | null) {
    if (p) localStorage.setItem(almacenamiento, JSON.stringify(p));
    else localStorage.removeItem(almacenamiento);
    window.dispatchEvent(new Event("zav-operacion"));
  }
  const vendedorFiltro = vista === "inventario" ? vendedor : "";
  const cargar = useCallback(() => {
    const revision = ++revisionLista.current;
    return Promise.all([
        vista === "nueva"
          ? gestion<{ items: Disponible[] }>("operaciones/disponibilidad")
          : null,
        vista === "historial" || vista === "devoluciones"
          ? gestion<{ items: Operacion[]; total: number }>(
              `operaciones?limit=20&page=${page}${vista === "devoluciones" ? "&tipo=DEVOLUCION" : modo === "venta-directa" ? "&tipo=SALIDA_DIRECTA" : ""}`,
            )
          : null,
        modo === "custodia" && (vista === "nueva" || vista === "inventario")
          ? gestion<{ items: { id: string; nombre: string }[] }>(
              "operaciones/vendedores",
            )
          : null,
        vista === "inventario"
          ? gestion<{ items: Custodia[] }>(
              `operaciones/custodia?limit=50&page=${custodiaPage}${vendedorFiltro ? "&vendedorId=" + vendedorFiltro : ""}`,
            )
          : null,
        vista === "inventario"
          ? gestion<{ conciliado: boolean }>("operaciones/conciliacion")
          : null,
      ]).then(([d, h, v, c, conc]) => {
      if (revision !== revisionLista.current) return;
      setError("");
      if (d) setDisponibles(d.items);
      if (h) {
        setHistorial(h.items);
        setTotal(h.total);
      }
      if (v) setVendedores(v.items);
      if (c) setCustodia(c.items);
      if (conc) setConciliado(conc.conciliado);
    }).catch((e) => {
      if (revision === revisionLista.current) setError(mensajeError(e));
    }).finally(() => {
      if (revision === revisionLista.current) setCargando(false);
    });
  }, [vista, page, modo, vendedorFiltro, custodiaPage]);
  useEffect(() => {
    void cargar();
    return () => {
      revisionLista.current++;
    };
  }, [cargar]);
  function cambiarVista(v: typeof vista) {
    if (v === vista) {
      setCargando(true);
      void cargar();
      return;
    }
    revisionLista.current++;
    setCargando(true);
    setVista(v);
    setPage(1);
    setCustodiaPage(1);
    setError("");
    setMensaje("");
  }
  function cerrarDetalle() {
    revisionDetalle.current++;
    setDetalleAbierto(false);
  }
  async function abrirDetalle(id: string) {
    const revision = ++revisionDetalle.current;
    setDetalle(null);
    setErrorDetalle("");
    setDetalleAbierto(true);
    setCargandoDetalle(true);
    try {
      const resultado = await gestion<Detalle>(`operaciones/${id}`);
      if (revision === revisionDetalle.current) setDetalle(resultado);
    } catch (e) {
      if (revision === revisionDetalle.current)
        setErrorDetalle(mensajeError(e));
    } finally {
      if (revision === revisionDetalle.current) setCargandoDetalle(false);
    }
  }
  async function enviar(p: Pendiente) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setEnviando(true);
    setError("");
    setMensaje("");
    try {
      const previa = leerPendiente();
      if (previa && previa !== JSON.stringify(p))
        throw new Error(
          "Primero verifica la operación pendiente antes de registrar otra.",
        );
      // Persistir la solicitud exacta antes del primer envío: un error de red no crea otra clave.
      persistir(p);
      const resultado = await gestion<Detalle>(p.ruta, "POST", p.datos);
      persistir(null);
      setComprobante(resultado);
      if (detalleAbierto) setDetalle(resultado);
      setSeleccion({});
      setMensaje(
        resultado.tipo === "CARGA"
          ? "Carga registrada. El vendedor ya puede recibirla."
          : resultado.tipo === "SALIDA_DIRECTA"
            ? "Venta registrada correctamente."
            : "Operación registrada correctamente.",
      );
      await cargar();
    } catch (e) {
      setError(mensajeError(e));
      if (
        e instanceof ErrorGestion &&
        e.estado >= 400 &&
        e.estado < 500 &&
        e.estado !== 401 &&
        e.estado !== 408 &&
        e.estado !== 429
      ) {
        persistir(null);
      }
    } finally {
      bloqueo.current = false;
      setEnviando(false);
    }
  }
  const elegidos = disponibles.filter(
    (p) =>
      /^\d+$/.test(seleccion[p.productoId] ?? "") &&
      Number(seleccion[p.productoId]) > 0,
  );
  const errorSeleccion = (() => {
    for (const [id, escrito] of Object.entries(seleccion)) {
      if (escrito === "" || /^0+$/.test(escrito)) continue;
      const cantidad = Number(escrito);
      const p = disponibles.find((p) => p.productoId === id);
      if (!p)
        return "Un producto seleccionado dejó de estar disponible. Actualiza la lista y revisa la selección.";
      if (
        !/^\d+$/.test(escrito) ||
        !Number.isSafeInteger(cantidad) ||
        cantidad < 0 ||
        cantidad > 2147483647
      )
        return `${p.nombre}: ingresa unidades enteras, sin decimales ni valores negativos.`;
      if (cantidad > p.cantidadDisponible)
        return `${p.nombre}: solo hay ${p.cantidadDisponible} unidades libres. Revisa la cantidad aunque el producto esté oculto por la búsqueda.`;
    }
    if (elegidos.length > 50)
      return "Selecciona como máximo 50 presentaciones por operación.";
    return "";
  })();
  const resumen = elegidos
    .map((p) => `${seleccion[p.productoId]} × ${p.nombre} (${p.presentacion})`)
    .join("; ");
  async function crear() {
    if (pendiente || !lista) return;
    if (
      errorSeleccion ||
      !elegidos.length ||
      (modo === "custodia" && !vendedores.some((v) => v.id === vendedor))
    ) {
      setError(
        errorSeleccion ||
          "Selecciona productos y, para una carga, un Vendedor válido.",
      );
      return;
    }
    await enviar({
      version: 1,
      ruta: `operaciones/${modo === "custodia" ? "cargas" : "salidas-directas"}`,
      datos: {
        operacionClave: crypto.randomUUID(),
        detalles: elegidos.map((p) => ({
          productoId: p.productoId,
          cantidad: Number(seleccion[p.productoId]),
        })),
        ...(modo === "custodia" ? { vendedorId: vendedor } : {}),
      },
      resumen,
    });
  }
  return (
    <section className="gestion-modulo">
      <nav
        className="gestion-tabs"
        aria-label={
          modo === "custodia" ? "Mercancía en distribución" : "Venta directa"
        }
      >
        <button
          className={
            vista === "nueva"
              ? "boton boton-primario"
              : "boton boton-secundario"
          }
          onClick={() => cambiarVista("nueva")}
        >
          {modo === "custodia" ? "Nueva carga" : "Nueva venta"}
        </button>
        {modo === "custodia" && (
          <>
            <button
              className={
                vista === "inventario"
                  ? "boton boton-primario"
                  : "boton boton-secundario"
              }
              onClick={() => cambiarVista("inventario")}
            >
              Mercancía por vendedor
            </button>
            <button
              className={
                vista === "devoluciones"
                  ? "boton boton-primario"
                  : "boton boton-secundario"
              }
              onClick={() => cambiarVista("devoluciones")}
            >
              Devoluciones
            </button>
          </>
        )}
        <button
          className={
            vista === "historial"
              ? "boton boton-primario"
              : "boton boton-secundario"
          }
          onClick={() => cambiarVista("historial")}
        >
          Historial
        </button>
      </nav>
      {errorAlmacenamiento && (
        <p className="gestion-error" role="alert">
          {errorAlmacenamiento}
        </p>
      )}
      {error && (
        <p className="gestion-error" role="alert">
          {error}
        </p>
      )}
      {mensaje && (
        <p className="gestion-exito" role="status">
          {mensaje}{" "}
          {comprobante && (
            <button
              className="boton boton-terciario"
              onClick={() => void abrirDetalle(comprobante.id)}
            >
              Ver detalle
            </button>
          )}
        </p>
      )}
      {pendiente && (
        <section className="gestion-editor">
          <h2>Operación pendiente de verificar</h2>
          <p>{pendiente.resumen}</p>
          <p>Comprueba el resultado antes de hacer otra operación.</p>
          <button
            className="boton boton-primario"
            disabled={enviando}
            onClick={() => void enviar(pendiente)}
          >
            {enviando ? "Verificando…" : "Verificar / reintentar"}
          </button>
        </section>
      )}
      {vista === "nueva" && (
        <section className="gestion-editor">
          <h2>
            {modo === "custodia" ? "Preparar carga" : "Nueva venta directa"}
          </h2>
          <p>
            {modo === "custodia"
              ? "Selecciona el vendedor y los productos que llevará."
              : "Consumidor final · Entrega en despacho"}
          </p>
          {modo === "venta-directa" && (
            <Link className="publico-link" href="/panel?vista=distribucion">
              Ubicación del despacho
            </Link>
          )}
          <form
            action={crear}
            className="formulario"
            onInvalid={manejarInvalido}
            onInput={limpiarInvalido}
            onChange={limpiarInvalido}
          >
            <fieldset
              disabled={!!pendiente || enviando || !lista}
              className="gestion-ancho gestion-fieldset"
            >
              {modo === "custodia" && (
                <label className="campo">
                  Vendedor destinatario
                  <select
                    required
                    value={vendedor}
                    onChange={(e) => {
                      setVendedor(e.target.value);
                      setCustodiaPage(1);
                    }}
                  >
                    <option value="">Seleccionar Vendedor</option>
                    {vendedores.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="campo">
                Buscar producto o presentación
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </label>
              <div className="gestion-seleccion">
                {disponibles
                  .filter((p) =>
                    `${p.nombre} ${p.codigo} ${p.presentacion}`
                      .toLocaleLowerCase()
                      .includes(busqueda.toLocaleLowerCase()),
                  )
                  .map((p) => (
                    <label className="gestion-linea" key={p.productoId}>
                      <span>
                        <strong>{p.nombre}</strong>
                        <small>
                          {p.codigo} · {p.presentacion}
                        </small>
                        <small>
                          {p.cantidadDisponible} libres ·{" "}
                          {p.cantidadComprometida ?? 0} comprometidas
                        </small>
                      </span>
                      <span className="campo">
                        Cantidad
                        <input
                          aria-label={`Cantidad ${p.codigo}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          data-validacion="Ingresa unidades enteras, sin signos ni decimales."
                          placeholder="0"
                          value={seleccion[p.productoId] ?? ""}
                          disabled={p.cantidadDisponible === 0}
                          onChange={(e) =>
                            setSeleccion((s) => ({
                              ...s,
                              [p.productoId]: e.target.value,
                            }))
                          }
                        />
                      </span>
                    </label>
                  ))}
              </div>
              {!cargando && disponibles.length === 0 && (
                <p>
                  No hay presentaciones habilitadas. Revisa el catálogo y la
                  validación comercial.
                </p>
              )}
              <div className="gestion-resumen">
                <h3>Resumen de entrega</h3>
                {errorSeleccion && (
                  <p className="gestion-error" role="alert">
                    {errorSeleccion}
                  </p>
                )}
                {Object.keys(seleccion).length > 0 && (
                  <button
                    type="button"
                    className="boton boton-terciario"
                    onClick={() => setSeleccion({})}
                  >
                    Limpiar selección
                  </button>
                )}
                {elegidos.length ? (
                  <ul>
                    {elegidos.map((p) => (
                      <li key={p.productoId}>
                        {seleccion[p.productoId]} × {p.nombre} ·{" "}
                        {p.presentacion}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Selecciona cantidades para continuar.</p>
                )}
                <p>
                  {elegidos.reduce(
                    (s, p) => s + Number(seleccion[p.productoId]),
                    0,
                  )}{" "}
                  unidades en total.
                </p>
              </div>
              <BotonEnviar
                disabled={elegidos.length === 0 || cargando || !!errorSeleccion}
                pendiente="Registrando…"
                confirmacion={{
                  titulo:
                    modo === "custodia"
                      ? "Confirmar carga"
                      : "Confirmar entrega",
                  mensaje: resumen,
                  confirmar: "Confirmar",
                }}
              >
                {modo === "custodia" ? "Registrar carga" : "Confirmar entrega"}
              </BotonEnviar>
            </fieldset>
          </form>
        </section>
      )}
      {vista === "inventario" && (
        <section className="gestion-editor">
          <div className="gestion-barra">
            <h2>Mercancía por vendedor</h2>
            <button
              className="boton boton-secundario"
              disabled={cargando}
              onClick={() => {
                setCargando(true);
                void cargar();
              }}
            >
              Actualizar
            </button>
          </div>
          <label className="campo">
            Vendedor
            <select
              value={vendedor}
              onChange={(e) => {
                setCargando(true);
                setVendedor(e.target.value);
                setCustodiaPage(1);
              }}
            >
              <option value="">Todos los vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </label>
          <p>
            {conciliado === null
              ? "Comprobando inventario…"
              : conciliado
                ? "Inventario al día"
                : "Hay diferencias o mercancía sin responsable: revisar antes de operar."}
          </p>
          <div className="gestion-tabla">
            <table>
              <thead>
                <tr>
                  <th>Vendedor / Producto</th>
                  <th>Lote / Vencimiento</th>
                  <th>Uso</th>
                  <th>En su poder</th>
                  <th>Para vender</th>
                  <th>Por recibir</th>
                  <th>Condición</th>
                </tr>
              </thead>
              <tbody>
                {!cargando &&
                  custodia.map((c) => (
                    <tr key={`${c.vendedorId}-${c.loteId}-${c.finalidad}`}>
                      <td>
                        {c.vendedorNombre}
                        <p>
                          {c.nombre} · {c.presentacion}
                        </p>
                      </td>
                      <td>
                        {c.loteCodigo}
                        <p>{c.venceEl.slice(0, 10)}</p>
                      </td>
                      <td>{etiquetaOperacion(c.finalidad)}</td>
                      <td>{c.cantidad}</td>
                      <td>{c.libre}</td>
                      <td>{c.pendiente}</td>
                      <td>{etiquetaOperacion(c.condicion)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="gestion-barra">
            <button
              className="boton boton-secundario"
              disabled={custodiaPage === 1 || cargando}
              onClick={() => {
                setCargando(true);
                setCustodiaPage((p) => p - 1);
              }}
            >
              Anterior
            </button>
            <span>Página {custodiaPage}</span>
            <button
              className="boton boton-secundario"
              disabled={custodia.length < 50 || cargando}
              onClick={() => {
                setCargando(true);
                setCustodiaPage((p) => p + 1);
              }}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}
      {(vista === "historial" || vista === "devoluciones") && (
        <section className="gestion-editor">
          <div className="gestion-barra">
            <h2>{vista === "devoluciones" ? "Devoluciones" : "Historial"}</h2>
            <button
              className="boton boton-secundario"
              disabled={cargando}
              onClick={() => {
                setCargando(true);
                void cargar();
              }}
            >
              Actualizar
            </button>
          </div>
          {cargando && <p role="status">Cargando operaciones…</p>}
          <div className="gestion-tabla">
            <table>
              <thead>
                <tr>
                  <th>Fecha / Operación</th>
                  <th>Responsable</th>
                  <th>Vendedor</th>
                  <th>Estado</th>
                  <th>Unidades</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {!cargando &&
                  historial.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {new Date(o.creadoEn).toLocaleString("es-BO", {
                          timeZone: "America/La_Paz",
                        })}
                        <p>{etiquetaOperacion(o.tipo)}</p>
                      </td>
                      <td>{o.responsable}</td>
                      <td>{o.vendedorNombre ?? "Mostrador"}</td>
                      <td>
                        <span
                          className={`gestion-estado ${o.estado === "PENDIENTE_RECEPCION" ? "estado-ambar" : "estado-verde"}`}
                        >
                          {o.reversionId
                            ? "Devuelta"
                            : etiquetaOperacion(o.estado)}
                        </span>
                      </td>
                      <td>{o.unidades}</td>
                      <td>
                        <button
                          className="boton boton-secundario"
                          onClick={() => void abrirDetalle(o.id)}
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="gestion-barra">
            <button
              className="boton boton-secundario"
              disabled={page === 1 || cargando}
              onClick={() => {
                setCargando(true);
                setPage((p) => p - 1);
              }}
            >
              Anterior
            </button>
            <span>
              Página {page} · {total} operaciones
            </span>
            <button
              className="boton boton-secundario"
              disabled={page * 20 >= total || cargando}
              onClick={() => {
                setCargando(true);
                setPage((p) => p + 1);
              }}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}
      {detalleAbierto && (
        <Ventana
          titulo={
            detalle ? etiquetaOperacion(detalle.tipo) : "Detalle de operación"
          }
          etiqueta="COMPROBANTE"
          amplia
          cerrar={cerrarDetalle}
        >
          {cargandoDetalle && (
            <p className="gestion-cargando" role="status">
              Cargando detalle…
            </p>
          )}
          {errorDetalle && (
            <p className="gestion-error" role="alert">
              {errorDetalle}
            </p>
          )}
          {detalle && (
            <section
              className="detalle-operacion"
              aria-label="Detalle de operación"
            >
              <span
                className={`gestion-estado ${detalle.estado === "PENDIENTE_RECEPCION" ? "estado-ambar" : "estado-verde"}`}
              >
                {etiquetaOperacion(detalle.estado)}
              </span>
              <p>
                {detalle.responsable} ·{" "}
                {detalle.clienteNombre ?? detalle.vendedorNombre} ·{" "}
                {new Date(detalle.creadoEn).toLocaleString("es-BO", {
                  timeZone: "America/La_Paz",
                })}
              </p>
              {detalle.latitud !== null && (
                <p>
                  Ubicación de entrega: {detalle.latitud}, {detalle.longitud}
                  {detalle.precisionM && ` · precisión ${detalle.precisionM} m`}
                </p>
              )}
              {detalle.motivo && <p>Motivo: {detalle.motivo}</p>}
              {detalle.detalles.map((d) => (
                <article key={d.productoId}>
                  <h3>
                    {d.cantidad} × {d.productoHistorico.nombre} ·{" "}
                    {d.productoHistorico.presentacion}
                  </h3>
                  <p>
                    {d.precioUnitarioBob === null
                      ? "Sin precio comercial validado al registrar."
                      : `Precio histórico unitario: Bs ${d.precioUnitarioBob}`}
                  </p>
                  <ul>
                    {d.lotes.map((l) => (
                      <li key={l.loteId}>
                        Lote {l.codigo} · {l.cantidad} unidades ·{" "}
                        {etiquetaOperacion(l.condicionAlRegistrar)}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
              {detalle.eventos.map((e, i) => (
                <p key={i}>
                  {etiquetaOperacion(e.accion)}: {e.responsable} ·{" "}
                  {new Date(e.creadoEn).toLocaleString("es-BO", {
                    timeZone: "America/La_Paz",
                  })}
                </p>
              ))}
              {detalle.tipo === "DEVOLUCION" &&
                detalle.estado === "PENDIENTE_RECEPCION" && (
                  <form
                    className="formulario gestion-formulario"
                    action={async (form) => {
                      await enviar({
                        version: 1,
                        ruta: `operaciones/${detalle.id}/recibir-devolucion`,
                        datos: {
                          operacionClave: crypto.randomUUID(),
                          observacion: String(form.get("observacion")),
                        },
                        resumen: `Recibir devolución de ${detalle.vendedorNombre ?? detalle.responsable}`,
                      });
                    }}
                  >
                    <label className="campo">
                      Observación de recepción
                      <input name="observacion" required maxLength={300} />
                    </label>
                    <BotonEnviar
                      disabled={!!pendiente || enviando}
                      confirmacion={{
                        titulo: "Recibir devolución",
                        mensaje:
                          "Recibe los productos indicados. Quedarán en revisión antes de volver a venderse.",
                        confirmar: "Recibir a inspección",
                      }}
                    >
                      Recibir devolución
                    </BotonEnviar>
                  </form>
                )}
              {detalle.tipo === "SALIDA_DIRECTA" && !detalle.reversionId && (
                <form
                  className="formulario gestion-formulario"
                  action={async (form) => {
                    await enviar({
                      version: 1,
                      ruta: `operaciones/${detalle.id}/reversion`,
                      datos: {
                        operacionClave: crypto.randomUUID(),
                        motivo: String(form.get("motivo")),
                        recepcionFisicaConfirmada: form.get("fisico") === "on",
                      },
                      resumen: `Devolución de venta de ${fechaOperacion(detalle.creadoEn)}`,
                    });
                  }}
                >
                  <label className="campo">
                    Motivo de reversión
                    <input name="motivo" required maxLength={300} />
                  </label>
                  <label className="gestion-check">
                    <input name="fisico" type="checkbox" required /> Recibí
                    físicamente todas las unidades y lotes
                  </label>
                  <BotonEnviar
                    disabled={!!pendiente || enviando}
                    confirmacion={{
                      titulo: "Recibir devolución de venta",
                      mensaje:
                        "El historial se conservará. Las unidades recibidas ingresarán a inspección.",
                      confirmar: "Registrar devolución",
                    }}
                  >
                    Devolver esta venta
                  </BotonEnviar>
                </form>
              )}
            </section>
          )}
        </Ventana>
      )}
    </section>
  );
}

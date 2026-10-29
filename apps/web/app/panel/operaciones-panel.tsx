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
import { BotonEnviar } from "../componentes/interacciones";
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
  const [disponibles, setDisponibles] = useState<Disponible[]>([]);
  const [vendedores, setVendedores] = useState<
    { id: string; nombre: string }[]
  >([]);
  const [vendedor, setVendedor] = useState("");
  const [seleccion, setSeleccion] = useState<Record<string, number>>({});
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
  const cargar = useCallback(
    () =>
      Promise.all([
        gestion<{ items: Disponible[] }>("operaciones/disponibilidad"),
        gestion<{ items: Operacion[]; total: number }>(
          `operaciones?limit=20&page=${page}${modo === "venta-directa" ? "&tipo=SALIDA_DIRECTA" : ""}`,
        ),
        modo === "custodia"
          ? gestion<{ items: { id: string; nombre: string }[] }>(
              "operaciones/vendedores",
            )
          : null,
        modo === "custodia"
          ? gestion<{ items: Custodia[] }>(
              `operaciones/custodia?limit=50&page=${custodiaPage}${vendedor ? "&vendedorId=" + vendedor : ""}`,
            )
          : null,
        modo === "custodia"
          ? gestion<{ conciliado: boolean }>("operaciones/conciliacion")
          : null,
      ])
        .then(([d, h, v, c, conc]) => {
          setDisponibles(d.items);
          setHistorial(h.items);
          setTotal(h.total);
          if (v) setVendedores(v.items);
          if (c) setCustodia(c.items);
          if (conc) setConciliado(conc.conciliado);
        })
        .catch((e) => setError(mensajeError(e)))
        .finally(() => setCargando(false)),
    [page, modo, vendedor, custodiaPage],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);
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
      setDetalle(resultado);
      setSeleccion({});
      setMensaje(`Confirmado por la API: ${resultado.id}.`);
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
    (p) => (seleccion[p.productoId] ?? 0) > 0,
  );
  const resumen = elegidos
    .map((p) => `${seleccion[p.productoId]} × ${p.nombre} (${p.presentacion})`)
    .join("; ");
  async function crear() {
    if (pendiente || !lista) return;
    await enviar({
      version: 1,
      ruta: `operaciones/${modo === "custodia" ? "cargas" : "salidas-directas"}`,
      datos: {
        operacionClave: crypto.randomUUID(),
        detalles: elegidos.map((p) => ({
          productoId: p.productoId,
          cantidad: seleccion[p.productoId],
        })),
        ...(modo === "custodia" ? { vendedorId: vendedor } : {}),
      },
      resumen,
    });
  }
  return (
    <section className="gestion-modulo">
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
          {mensaje}
        </p>
      )}
      {pendiente && (
        <section className="gestion-editor">
          <h2>Operación pendiente de verificar</h2>
          <p>{pendiente.resumen}</p>
          <p>
            Clave: <code>{String(pendiente.datos.operacionClave)}</code>.
            Reintentar recupera el resultado si ya se registró.
          </p>
          <button
            className="boton boton-primario"
            disabled={enviando}
            onClick={() => void enviar(pendiente)}
          >
            {enviando ? "Verificando…" : "Verificar / reintentar"}
          </button>
        </section>
      )}
      <section className="gestion-editor">
        <h2>
          {modo === "custodia"
            ? "Asignar carga libre a un Vendedor"
            : "Nueva venta directa"}
        </h2>
        <p>
          {modo === "custodia"
            ? "La mercancía se trasladará del despacho a distribución. El destinatario debe confirmar recepción para poder venderla."
            : "Cliente: Consumidor final. Origen: VENTA_DESPACHO. Se entregan únicamente unidades libres de compromisos."}
        </p>
        {modo === "venta-directa" && (
          <Link className="publico-link" href="/panel?vista=distribucion">
            Configurar o revisar ubicación del despacho
          </Link>
        )}
        <form action={crear} className="formulario gestion-formulario">
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
                        type="number"
                        min="0"
                        max={p.cantidadDisponible}
                        step="1"
                        value={seleccion[p.productoId] ?? 0}
                        disabled={p.cantidadDisponible === 0}
                        onChange={(e) =>
                          setSeleccion((s) => ({
                            ...s,
                            [p.productoId]: Number(e.target.value),
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
              {elegidos.length ? (
                <ul>
                  {elegidos.map((p) => (
                    <li key={p.productoId}>
                      {seleccion[p.productoId]} × {p.nombre} · {p.presentacion}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Selecciona cantidades para continuar.</p>
              )}
              <p>
                {elegidos.reduce((s, p) => s + seleccion[p.productoId], 0)}{" "}
                unidades. Los lotes se asignan por vencimiento al confirmar.
              </p>
            </div>
            <BotonEnviar
              disabled={elegidos.length === 0 || cargando}
              pendiente="Registrando…"
              confirmacion={{
                titulo:
                  modo === "custodia" ? "Confirmar carga" : "Confirmar entrega",
                mensaje: resumen,
                confirmar: "Confirmar",
              }}
            >
              {modo === "custodia" ? "Registrar carga" : "Confirmar entrega"}
            </BotonEnviar>
          </fieldset>
        </form>
      </section>
      {modo === "custodia" && (
        <section className="gestion-editor">
          <h2>Custodia por Vendedor y lote</h2>
          <p>
            {conciliado === null
              ? "Conciliación pendiente."
              : conciliado
                ? "Los movimientos de distribución concilian con la custodia."
                : "Hay diferencias o mercancía sin responsable: revisar antes de operar."}
          </p>
          <div className="gestion-tabla">
            <table>
              <thead>
                <tr>
                  <th>Vendedor / Producto</th>
                  <th>Lote / Vencimiento</th>
                  <th>Finalidad</th>
                  <th>Físico</th>
                  <th>Libre</th>
                  <th>Pendiente</th>
                  <th>Condición</th>
                </tr>
              </thead>
              <tbody>
                {custodia.map((c) => (
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
                    <td>{c.finalidad}</td>
                    <td>{c.cantidad}</td>
                    <td>{c.libre}</td>
                    <td>{c.pendiente}</td>
                    <td>{c.condicion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="gestion-barra">
            <button
              className="boton boton-secundario"
              disabled={custodiaPage === 1 || cargando}
              onClick={() => setCustodiaPage((p) => p - 1)}
            >
              Anterior custodia
            </button>
            <span>Página {custodiaPage}</span>
            <button
              className="boton boton-secundario"
              disabled={custodia.length < 50 || cargando}
              onClick={() => setCustodiaPage((p) => p + 1)}
            >
              Más custodia
            </button>
          </div>
        </section>
      )}
      <section className="gestion-editor">
        <div className="gestion-barra">
          <h2>
            Historial{" "}
            {modo === "custodia" ? "y devoluciones" : "de ventas directas"}
          </h2>
          <button
            className="boton boton-secundario"
            disabled={cargando}
            onClick={() => void cargar()}
          >
            Actualizar
          </button>
        </div>
        {cargando && <p role="status">Consultando inventario e historial…</p>}
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
              {historial.map((o) => (
                <tr key={o.id}>
                  <td>
                    {new Date(o.creadoEn).toLocaleString("es-BO", {
                      timeZone: "America/La_Paz",
                    })}
                    <p>{o.tipo}</p>
                  </td>
                  <td>{o.responsable}</td>
                  <td>{o.vendedorNombre ?? "Mostrador"}</td>
                  <td>
                    {o.estado}
                    {o.reversionId && " · Revertida"}
                  </td>
                  <td>{o.unidades}</td>
                  <td>
                    <button
                      className="boton boton-secundario"
                      onClick={async () => {
                        try {
                          setDetalle(
                            await gestion<Detalle>(`operaciones/${o.id}`),
                          );
                        } catch (e) {
                          setError(mensajeError(e));
                        }
                      }}
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
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page} · {total} operaciones
          </span>
          <button
            className="boton boton-secundario"
            disabled={page * 20 >= total || cargando}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      </section>
      {detalle && (
        <section className="gestion-editor" aria-label="Detalle de operación">
          <div className="gestion-barra">
            <h2>
              {detalle.tipo} · {detalle.estado}
            </h2>
            <button
              className="boton boton-terciario"
              onClick={() => setDetalle(null)}
            >
              Cerrar detalle
            </button>
          </div>
          <p>
            <code>{detalle.id}</code>
          </p>
          <p>
            {detalle.responsable} ·{" "}
            {detalle.clienteNombre ?? detalle.vendedorNombre} ·{" "}
            {new Date(detalle.creadoEn).toLocaleString("es-BO", {
              timeZone: "America/La_Paz",
            })}
          </p>
          {detalle.latitud && (
            <p>
              Ubicación histórica: {detalle.latitud}, {detalle.longitud}
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
                    {l.codigo}: {l.cantidad} · {l.condicionAlRegistrar} ·{" "}
                    {l.movimientoId
                      ? `Movimiento ${l.movimientoId}`
                      : "Pendiente de recepción"}
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {detalle.eventos.map((e, i) => (
            <p key={i}>
              {e.accion}: {e.responsable} ·{" "}
              {new Date(e.creadoEn).toLocaleString("es-BO", { timeZone: "America/La_Paz" })}
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
                    resumen: `Recepción a inspección: ${detalle.id}`,
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
                      "Confirma la recepción física de todas las cantidades detalladas. Se trasladarán a DEVOLUCIONES_INSPECCION.",
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
                  resumen: `Reversión con recepción física: ${detalle.id}`,
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
                  titulo: "Revertir salida con recepción física",
                  mensaje:
                    "El historial se conservará. Las unidades recibidas ingresarán a inspección.",
                  confirmar: "Registrar reversión",
                }}
              >
                Revertir con recepción física
              </BotonEnviar>
            </form>
          )}
        </section>
      )}
    </section>
  );
}

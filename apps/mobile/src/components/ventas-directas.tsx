import { useActualizacionActiva } from '@/lib/use-actualizacion-activa';
import {
  DetalleOperacion,
  EstadoOperacion,
  nombreOperacion,
} from "./detalle-operacion";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ApiError,
  consultarCustodia,
  consultarOperacion,
  consultarOperaciones,
  consultarStockLibre,
} from "@/lib/api";
import {
  ejecutarOperacionPersistida,
  leerOperacionPendiente,
} from "@/lib/operacion-pendiente";
import { capturarUbicacionPuntual } from "@/lib/ubicacion-puntual";
import { fechaCorta } from "@/lib/distribucion";
import type {
  CustodiaLibre,
  OperacionDetalle,
  OperacionPendiente,
  OperacionResumen,
  StockLibre,
} from "@/lib/operaciones-tipos";
import type { Sesion } from "@/lib/tipos";
import { uuidV4 } from "@/lib/uuid";
import { errorCantidad, validarCantidades } from "@/lib/cantidades";
import { styles as s } from "@/screens/vendedor-estilos";

export function VentasDirectas({
  sesion,
  alCambiarVista,
  alNotificar,
  alErrorSesion,
}: {
  sesion: Sesion;
  alCambiarVista?: () => void;
  alNotificar: (tipo: "error" | "exito", mensaje: string) => void;
  alErrorSesion: (error: unknown) => Promise<void>;
}) {
  const token = sesion.accessToken,
    usuario = sesion.usuario.id;
  const [vista, setVista] = useState<
    "venta" | "custodia" | "cargas" | "devolucion" | "historial"
  >("venta");
  const [tipoHistorial, setTipoHistorial] =
    useState<OperacionResumen["tipo"]>("SALIDA_DIRECTA");
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState("");
  const revisionDetalle = useRef(0);
  const revisionLista = useRef(0);
  const [stock, setStock] = useState<StockLibre[]>([]);
  const [custodia, setCustodia] = useState<CustodiaLibre[]>([]);
  const [historial, setHistorial] = useState<OperacionResumen[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [devoluciones, setDevoluciones] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pendiente, setPendiente] = useState<OperacionPendiente | null>(null);
  const [detalle, setDetalle] = useState<OperacionDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [custodiaPage, setCustodiaPage] = useState(1);
  const bloqueo = useRef(false);
  const notificarError = useCallback((mensaje: string) => {
    if (mensaje) alNotificar("error", mensaje);
  }, [alNotificar]);
  const notificarExito = (mensaje: string) => alNotificar("exito", mensaje);
  const informarError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      void alErrorSesion(e);
    } else {
      notificarError(e instanceof Error ? e.message : "No se pudo completar la operación.");
    }
  }, [alErrorSesion, notificarError]);
  const cargar = useCallback(() => {
    const revision = ++revisionLista.current;
    return Promise.all([
        leerOperacionPendiente(usuario),
        vista === "venta" ? consultarStockLibre(token) : null,
        vista === "custodia" || vista === "devolucion"
          ? consultarCustodia(token, custodiaPage)
          : null,
        vista === "historial"
          ? consultarOperaciones(token, page, tipoHistorial)
          : vista === "cargas"
            ? consultarOperaciones(token, page, "CARGA", "PENDIENTE_RECEPCION")
            : null,
      ]).then(([p, d, c, h]) => {
      if (revision !== revisionLista.current) return;
      setPendiente(p);
      if (d) setStock(d.items);
      if (c) setCustodia(c.items);
      if (h) {
        setHistorial(h.items);
        setTotal(h.total);
      }
      setListo(true);
    }).catch((e) => {
      if (revision === revisionLista.current) {
        setListo(false);
        informarError(e);
      }
    }).finally(() => {
      if (revision === revisionLista.current) setCargando(false);
    });
  }, [usuario, token, vista, page, custodiaPage, tipoHistorial, informarError]);
  useEffect(() => {
    void cargar();
    return () => {
      revisionLista.current++;
    };
  }, [cargar]);
  useActualizacionActiva(cargar, cargando || ocupado || detalleAbierto || !!pendiente || Object.values(cantidades).some(v => Number(v) > 0) || Object.values(devoluciones).some(v => Number(v) > 0));
  const cambiarVista = useCallback((v: typeof vista) => {
    if (v === vista) {
      setCargando(true);
      void cargar();
      return;
    }
    revisionLista.current++;
    setVista(v);
    setPage(1);
    setCustodiaPage(1);
    setCargando(true);
    setListo(false);
    alCambiarVista?.();
  }, [vista, cargar, alCambiarVista]);
  useEffect(() => {
    if (vista === "venta") return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      cambiarVista(vista === "cargas" || vista === "devolucion" ? "custodia" : "venta");
      return true;
    });
    return () => listener.remove();
  }, [vista, cambiarVista]);
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
      const d = await consultarOperacion(token, id);
      if (revision === revisionDetalle.current) setDetalle(d);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        cerrarDetalle();
        informarError(e);
        return;
      }
      if (revision === revisionDetalle.current)
        setErrorDetalle(
          e instanceof Error ? e.message : "No se pudo cargar el detalle.",
        );
    } finally {
      if (revision === revisionDetalle.current) setCargandoDetalle(false);
    }
  }
  async function enviar(p: OperacionPendiente) {
    if (bloqueo.current) return;
    revisionLista.current++;
    bloqueo.current = true;
    setOcupado(true);
    try {
      const resultado = await ejecutarOperacionPersistida(usuario, token, p);
      setPendiente(null);
      setCantidades({});
      setDevoluciones({});
      setMotivo("");
      notificarExito(
        resultado.tipo === "SALIDA_DIRECTA"
          ? "Venta registrada correctamente."
          : resultado.tipo === "CARGA"
            ? "Carga recibida. Ya puedes vender estos productos."
            : "Devolución enviada al despacho.",
      );
      await cargar();
    } catch (e) {
      informarError(e);
      try {
        setPendiente(await leerOperacionPendiente(usuario));
      } catch {
        setListo(false);
      }
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  const seleccion = stock.filter(
    (p) => Number(cantidades[p.productoId] ?? 0) > 0,
  );
  const devolucionEnEdicion = Object.values(devoluciones).some(
    (v) => v !== "" && !/^0+$/.test(v),
  );
  async function prepararVenta() {
    if (bloqueo.current || pendiente || !listo) return;
    const errorCantidades = validarCantidades(
      cantidades,
      stock.map((p) => ({
        id: p.productoId,
        nombre: p.nombre,
        disponible: p.cantidadDisponible,
      })),
    );
    if (errorCantidades) {
      notificarError(errorCantidades);
      return;
    }
    revisionLista.current++;
    bloqueo.current = true;
    setOcupado(true);
    try {
      const posicion = await capturarUbicacionPuntual(Location);
      if (posicion.coords.accuracy === null)
        throw new Error(
          "No se obtuvo precisión GPS. Intenta una nueva captura.",
        );
      const { latitude, longitude, accuracy } = posicion.coords;
      const resumen = seleccion
        .map(
          (p) =>
            `${cantidades[p.productoId]} × ${p.nombre} (${p.presentacion})`,
        )
        .join("\n");
      const p: OperacionPendiente = {
        version: 1,
        ruta: "operaciones/salidas-directas",
        resumen,
        datos: {
          operacionClave: uuidV4(),
          detalles: seleccion.map((p) => ({
            productoId: p.productoId,
            cantidad: Number(cantidades[p.productoId]),
          })),
          latitud: latitude,
          longitud: longitude,
          precisionMetros: accuracy,
        },
      };
      if (
        await confirmar(
          "Confirmar venta directa",
          `${resumen}\n\nConsumidor final\nUbicación: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}\nPrecisión: ±${Math.round(accuracy)} m`,
          "Confirmar entrega",
        )
      ) {
        validarVigenciaGPS(posicion.timestamp);
        bloqueo.current = false;
        await enviar(p);
      }
    } catch (e) {
      notificarError(
        e instanceof Error ? e.message : "No se pudo obtener ubicación.",
      );
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  async function prepararDevolucion() {
    if (bloqueo.current || pendiente || !listo) return;
    const seleccion = custodia.filter(
      (c) => c.finalidad === "LIBRE" && Number(devoluciones[c.loteId] ?? 0) > 0,
    );
    const errorCantidades = validarCantidades(
      devoluciones,
      custodia
        .filter((c) => c.finalidad === "LIBRE")
        .map((c) => ({
          id: c.loteId,
          nombre: c.loteCodigo,
          disponible: c.libre,
        })),
      100,
    );
    if (errorCantidades || !motivo.trim()) {
      notificarError(errorCantidades ?? "Describe el motivo de devolución.");
      return;
    }
    const resumen = seleccion
      .map(
        (c) => `${devoluciones[c.loteId]} × ${c.nombre}, lote ${c.loteCodigo}`,
      )
      .join("\n");
    const p: OperacionPendiente = {
      version: 1,
      ruta: "operaciones/devoluciones",
      resumen,
      datos: {
        operacionClave: uuidV4(),
        motivo: motivo.trim(),
        lotes: seleccion.map((c) => ({
          loteId: c.loteId,
          cantidad: Number(devoluciones[c.loteId]),
        })),
      },
    };
    revisionLista.current++;
    bloqueo.current = true;
    setOcupado(true);
    try {
      if (
        await confirmar(
          "Solicitar devolución",
          `${resumen}\n\nLas unidades quedarán apartadas hasta que el Administrador las reciba en inspección.`,
          "Solicitar",
        )
      ) {
        bloqueo.current = false;
        await enviar(p);
      }
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  async function prepararRecepcion(id: string) {
    if (bloqueo.current || pendiente || !listo) return;
    revisionLista.current++;
    bloqueo.current = true;
    setOcupado(true);
    try {
      const d = await consultarOperacion(token, id);
      setDetalle(d);
      const resumen = d.detalles
        .map((x) => `${x.cantidad} × ${x.productoHistorico.nombre}`)
        .join("\n");
      const p: OperacionPendiente = {
        version: 1,
        ruta: `operaciones/${id}/recepcion`,
        datos: { operacionClave: uuidV4() },
        resumen,
      };
      if (
        await confirmar(
          "Confirmar recepción física",
          resumen,
          "Recibí la carga",
        )
      ) {
        bloqueo.current = false;
        await enviar(p);
      }
    } catch (e) {
      informarError(e);
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  const deshabilitado = ocupado || !!pendiente || !listo;
  const titulo = {
    venta: "Venta directa",
    custodia: "Mi mercancía",
    cargas: "Recibir cargas",
    devolucion: "Devolver sobrantes",
    historial: "Historial",
  }[vista];
  const stockVisible = stock.filter((p) =>
    `${p.nombre} ${p.codigo} ${p.presentacion}`
      .toLocaleLowerCase()
      .includes(busqueda.toLocaleLowerCase()),
  );
  return (
    <View style={s.bloque}>
      <View style={ui.cabecera}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={ui.etiqueta}>VENTAS Y MERCANCÍA</Text>
          <Text style={s.titulo}>{titulo}</Text>
        </View>
        <Boton
          titulo="Actualizar"
          disabled={ocupado || cargando}
          onPress={() => {
            setCargando(true);
            setListo(false);
            void cargar();
          }}
        />
      </View>
      {vista === "venta" ? (
        <View style={ui.fila}>
          <Boton
            titulo="Mi mercancía"
            onPress={() => cambiarVista("custodia")}
          />
          <Boton titulo="Historial" onPress={() => cambiarVista("historial")} />
        </View>
      ) : (
        <Boton
          titulo={
            vista === "cargas" || vista === "devolucion"
              ? "Volver a mi mercancía"
              : "Volver a nueva venta"
          }
          onPress={() =>
            cambiarVista(
              vista === "cargas" || vista === "devolucion"
                ? "custodia"
                : "venta",
            )
          }
        />
      )}
      {pendiente && (
        <View style={[s.tarjeta, ui.pendiente]}>
          <Text style={ui.nombre}>Pendiente de verificar</Text>
          <Text>{pendiente.resumen}</Text>
          <Text style={s.descripcion}>
            Comprueba el resultado antes de hacer otra operación.
          </Text>
          <Boton
            titulo="Verificar / reintentar"
            activo
            disabled={ocupado}
            onPress={() => void enviar(pendiente)}
          />
        </View>
      )}
      {(cargando || ocupado) && (
        <ActivityIndicator
          color="#b83b17"
          accessibilityLabel={
            ocupado ? "Procesando operación" : "Cargando datos"
          }
        />
      )}
      {vista === "venta" && (
        <View style={s.bloque}>
          <TextInput
            accessibilityLabel="Buscar producto"
            style={s.input}
            placeholder="Buscar producto o presentación"
            value={busqueda}
            onChangeText={setBusqueda}
          />
          {!cargando && listo &&
            stockVisible.map((p) => (
              <View
                style={[
                  s.tarjeta,
                  Number(cantidades[p.productoId]) > 0 && ui.seleccionada,
                ]}
                key={p.productoId}
              >
                <View style={ui.fila}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={ui.nombre}>{p.nombre}</Text>
                    <Text style={s.descripcion}>{p.presentacion}</Text>
                    <Text style={ui.disponible}>
                      {p.cantidadDisponible} disponibles
                    </Text>
                  </View>
                  <View style={ui.cantidad}>
                    <Text style={ui.label}>Cantidad</Text>
                    <TextInput
                      style={[s.input, ui.numero]}
                      accessibilityLabel={`Cantidad ${p.codigo}`}
                      placeholder="0"
                      keyboardType="number-pad"
                      value={cantidades[p.productoId] ?? ""}
                      editable={!deshabilitado}
                      onChangeText={(v) =>
                        setCantidades((c) => ({ ...c, [p.productoId]: v }))
                      }
                    />
                  </View>
                </View>
                {!!errorCantidad(
                  cantidades[p.productoId] ?? "",
                  p.cantidadDisponible,
                ) && (
                  <Text accessibilityRole="alert" style={ui.errorTexto}>
                    {errorCantidad(
                      cantidades[p.productoId] ?? "",
                      p.cantidadDisponible,
                    )}
                  </Text>
                )}
              </View>
            ))}
          {!cargando && listo && !stockVisible.length && (
            <View style={s.vacio}>
              <Text style={s.textoSecundario}>
                {stock.length
                  ? "No encontramos ese producto."
                  : "Todavía no tienes productos para vender."}
              </Text>
              {!stock.length && (
                <Boton
                  titulo="Revisar cargas"
                  onPress={() => cambiarVista("cargas")}
                />
              )}
            </View>
          )}
          {seleccion.length > 0 && (
            <View style={ui.resumen}>
              <Text style={ui.nombre}>
                Tu selección ·{" "}
                {seleccion.reduce(
                  (n, p) => n + Number(cantidades[p.productoId]),
                  0,
                )}{" "}
                unidades
              </Text>
              {seleccion.map((p) => (
                <Text key={p.productoId}>
                  {cantidades[p.productoId]} × {p.nombre} · {p.presentacion}
                </Text>
              ))}
              <Text style={s.descripcion}>Consumidor final</Text>
              <Boton
                titulo="Limpiar selección"
                disabled={deshabilitado}
                onPress={() => setCantidades({})}
              />
            </View>
          )}
          <Boton
            titulo="Obtener ubicación y continuar"
            activo
            disabled={deshabilitado || !seleccion.length}
            onPress={() => void prepararVenta()}
          />
        </View>
      )}
      {(vista === "custodia" || vista === "devolucion") && (
        <View style={s.bloque}>
          {vista === "custodia" && (
            <View style={ui.fila}>
              <Boton
                titulo="Recibir cargas"
                activo
                onPress={() => cambiarVista("cargas")}
              />
              <Boton
                titulo="Devolver sobrantes"
                onPress={() => cambiarVista("devolucion")}
              />
            </View>
          )}
          {!cargando && listo &&
            custodia
              .filter(
                (c) =>
                  vista === "custodia" ||
                  (c.finalidad === "LIBRE" && c.libre > 0),
              )
              .map((c) => (
                <View
                  style={[
                    s.tarjeta,
                    c.finalidad === "PEDIDO" ? ui.reservada : ui.seleccionada,
                  ]}
                  key={`${c.loteId}-${c.finalidad}`}
                >
                  <Text style={ui.nombre}>{c.nombre}</Text>
                  <Text style={s.descripcion}>{c.presentacion}</Text>
                  <Text style={ui.disponible}>
                    {c.finalidad === "PEDIDO"
                      ? `${c.cantidad} reservadas para pedidos`
                      : vista === "devolucion" ? `${c.libre} disponibles para devolver` : `${c.elegible ? c.libre : 0} disponibles para vender`}
                  </Text>
                  {c.pendiente > 0 && (
                    <Text style={ui.avisoTexto}>
                      {c.pendiente} pendientes de recepción
                    </Text>
                  )}
                  <Text style={s.descripcion}>
                    Lote {c.loteCodigo} · vence {c.venceEl.slice(0, 10)}
                  </Text>
                  {!c.elegible && (
                    <Text style={ui.errorTexto}>
                      No habilitado para venta. Puedes devolverlo al despacho.
                    </Text>
                  )}
                  {vista === "devolucion" && (
                    <>
                      <Text style={ui.label}>Cantidad a devolver</Text>
                      <TextInput
                        style={s.input}
                        accessibilityLabel={`Devolver lote ${c.loteCodigo}`}
                        keyboardType="number-pad"
                        placeholder="0"
                        editable={!deshabilitado}
                        value={devoluciones[c.loteId] ?? ""}
                        onChangeText={(v) =>
                          setDevoluciones((d) => ({ ...d, [c.loteId]: v }))
                        }
                      />
                      {!!errorCantidad(
                        devoluciones[c.loteId] ?? "",
                        c.libre,
                      ) && (
                        <Text accessibilityRole="alert" style={ui.errorTexto}>
                          {errorCantidad(devoluciones[c.loteId] ?? "", c.libre)}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              ))}
          {!cargando && listo &&
            !custodia.some(
              (c) =>
                vista === "custodia" ||
                (c.finalidad === "LIBRE" && c.libre > 0),
            ) && (
              <View style={s.vacio}>
                <Text style={s.textoSecundario}>
                  {vista === "custodia"
                    ? "No tienes mercancía asignada."
                    : "No tienes sobrantes disponibles para devolver."}
                </Text>
              </View>
            )}
          {(custodiaPage > 1 || custodia.length >= 50) && (
            <View style={ui.fila}>
              <Boton
                titulo="Anterior"
                disabled={custodiaPage === 1 || ocupado || devolucionEnEdicion}
                onPress={() => {
                  setCargando(true);
                  setCustodiaPage((p) => p - 1);
                }}
              />
              <Text>Página {custodiaPage}</Text>
              <Boton
                titulo="Más lotes"
                disabled={
                  custodia.length < 50 || ocupado || devolucionEnEdicion
                }
                onPress={() => {
                  setCargando(true);
                  setCustodiaPage((p) => p + 1);
                }}
              />
            </View>
          )}
          {vista === "devolucion" && (
            <View style={ui.resumen}>
              <Text style={ui.nombre}>Motivo de devolución</Text>
              <TextInput
                style={[s.input, s.inputMultiline]}
                accessibilityLabel="Motivo de devolución"
                placeholder="Por ejemplo: sobrantes del recorrido"
                multiline
                maxLength={300}
                editable={!deshabilitado}
                value={motivo}
                onChangeText={setMotivo}
              />
              {devolucionEnEdicion && (
                <Boton
                  titulo="Limpiar devolución"
                  disabled={deshabilitado}
                  onPress={() => setDevoluciones({})}
                />
              )}
              <Boton
                titulo="Revisar devolución"
                activo
                disabled={
                  deshabilitado || !devolucionEnEdicion || !motivo.trim()
                }
                onPress={() => void prepararDevolucion()}
              />
            </View>
          )}
        </View>
      )}
      {(vista === "historial" || vista === "cargas") && (
        <View style={s.bloque}>
          {vista === "historial" && (
            <View style={ui.fila}>
              {(
                [
                  ["SALIDA_DIRECTA", "Ventas"],
                  ["CARGA", "Cargas"],
                  ["DEVOLUCION", "Devoluciones"],
                ] as const
              ).map(([tipo, texto]) => (
                <Boton
                  key={tipo}
                  titulo={texto}
                  activo={tipoHistorial === tipo}
                  onPress={() => {
                    if (tipo !== tipoHistorial) {
                      setCargando(true);
                      setTipoHistorial(tipo);
                      setPage(1);
                    }
                  }}
                />
              ))}
            </View>
          )}
          {!cargando && listo &&
            historial.map((o) => (
              <View
                key={o.id}
                style={[
                  s.tarjeta,
                  o.estado === "PENDIENTE_RECEPCION"
                    ? ui.pendiente
                    : ui.registrada,
                ]}
              >
                <View style={ui.fila}>
                  <Text style={[ui.nombre, { flex: 1 }]}>
                    {nombreOperacion(o.tipo)}
                  </Text>
                  <EstadoOperacion
                    estado={o.estado}
                    revertida={!!o.reversionId}
                  />
                </View>
                <Text style={s.descripcion}>
                  {fechaCorta(o.creadoEn)} · {o.unidades} unidades
                </Text>
                <View style={ui.fila}>
                  <Boton
                    titulo="Ver detalle"
                    onPress={() => void abrirDetalle(o.id)}
                  />
                  {o.tipo === "CARGA" && o.estado === "PENDIENTE_RECEPCION" && (
                    <Boton
                      titulo="Confirmar recepción"
                      activo
                      disabled={deshabilitado}
                      onPress={() => void prepararRecepcion(o.id)}
                    />
                  )}
                </View>
              </View>
            ))}
          {!cargando && listo && !historial.length && (
            <View style={s.vacio}>
              <Text style={s.textoSecundario}>
                {vista === "cargas"
                  ? "No hay cargas por recibir."
                  : "Todavía no hay operaciones en esta sección."}
              </Text>
            </View>
          )}
          {total > 20 && (
            <View style={ui.fila}>
              <Boton
                titulo="Anterior"
                disabled={page === 1 || ocupado || cargando}
                onPress={() => {
                  setCargando(true);
                  setPage((p) => p - 1);
                }}
              />
              <Text>Página {page}</Text>
              <Boton
                titulo="Siguiente"
                disabled={page * 20 >= total || ocupado || cargando}
                onPress={() => {
                  setCargando(true);
                  setPage((p) => p + 1);
                }}
              />
            </View>
          )}
        </View>
      )}
      <DetalleOperacion
        visible={detalleAbierto}
        detalle={detalle}
        cargando={cargandoDetalle}
        error={errorDetalle}
        cerrar={cerrarDetalle}
        cerrarError={() => setErrorDetalle("")}
      />
    </View>
  );
}
const ui = StyleSheet.create({
  cabecera: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  fila: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  etiqueta: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#a73a1d",
  },
  nombre: { fontSize: 16, fontWeight: "700", color: "#20201e" },
  label: { fontSize: 12, fontWeight: "700", color: "#66665e" },
  cantidad: { width: 76, gap: 5 },
  numero: { textAlign: "center", fontSize: 18 },
  disponible: { color: "#286344", fontWeight: "700", fontSize: 13 },
  seleccionada: {
    borderLeftWidth: 4,
    borderLeftColor: "#b83b17",
    backgroundColor: "#fffaf7",
  },
  reservada: {
    borderLeftWidth: 4,
    borderLeftColor: "#c98a18",
    backgroundColor: "#fffdf7",
  },
  registrada: { borderLeftWidth: 4, borderLeftColor: "#2d7a55" },
  pendiente: {
    borderLeftWidth: 4,
    borderLeftColor: "#c98a18",
    backgroundColor: "#fffdf7",
  },
  resumen: {
    backgroundColor: "#f8ebe5",
    borderWidth: 1,
    borderColor: "#d9a28f",
    borderRadius: 10,
    padding: 16,
    gap: 10,
  },
  error: {
    padding: 12,
    color: "#a1322c",
    backgroundColor: "#fcefeb",
    borderRadius: 6,
  },
  errorTexto: { color: "#a1322c", fontSize: 13 },
  avisoTexto: { color: "#795410", fontSize: 13 },
  exito: { padding: 12, gap: 8, backgroundColor: "#eaf4ed", borderRadius: 6 },
  exitoTexto: { color: "#286344", fontWeight: "700" },
});

function confirmar(
  titulo: string,
  mensaje: string,
  accion: string,
): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      titulo,
      mensaje,
      [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        { text: accion, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
function validarVigenciaGPS(timestamp: number) {
  if (Date.now() - timestamp > 120000)
    throw new Error(
      "La ubicación tiene más de dos minutos. Vuelve a capturarla antes de confirmar.",
    );
}
function Boton({
  titulo,
  onPress,
  disabled = false,
  activo = false,
}: {
  titulo: string;
  onPress: () => void;
  disabled?: boolean;
  activo?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: activo }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: 13,
        paddingVertical: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: activo ? "#b83b17" : "#ccc9bf",
        backgroundColor: activo ? "#b83b17" : "#fff",
        opacity: disabled ? 0.5 : 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: activo ? "#fff" : "#20201e", fontWeight: "700" }}>
        {titulo}
      </Text>
    </Pressable>
  );
}

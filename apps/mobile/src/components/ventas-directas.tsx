import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
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
import { styles as s } from "@/screens/vendedor-estilos";

export function VentasDirectas({ sesion }: { sesion: Sesion }) {
  const token = sesion.accessToken,
    usuario = sesion.usuario.id;
  const [vista, setVista] = useState<"venta" | "custodia" | "historial">(
    "venta",
  );
  const [stock, setStock] = useState<StockLibre[]>([]);
  const [custodia, setCustodia] = useState<CustodiaLibre[]>([]);
  const [historial, setHistorial] = useState<OperacionResumen[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [devoluciones, setDevoluciones] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pendiente, setPendiente] = useState<OperacionPendiente | null>(null);
  const [detalle, setDetalle] = useState<OperacionDetalle | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [custodiaPage, setCustodiaPage] = useState(1);
  const bloqueo = useRef(false);
  const cargar = useCallback(
    () =>
      Promise.all([
        leerOperacionPendiente(usuario),
        consultarStockLibre(token),
        consultarCustodia(token, custodiaPage),
        consultarOperaciones(token, page),
      ])
        .then(([p, d, c, h]) => {
          setPendiente(p);
          setStock(d.items);
          setCustodia(c.items);
          setHistorial(h.items);
          setTotal(h.total);
          setListo(true);
        })
        .catch((e) =>
          setError(e instanceof Error ? e.message : "No se pudo actualizar."),
        )
        .finally(() => setCargando(false)),
    [usuario, token, page, custodiaPage],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);
  async function enviar(p: OperacionPendiente) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      const resultado = await ejecutarOperacionPersistida(usuario, token, p);
      setDetalle(resultado);
      setPendiente(null);
      setCantidades({});
      setDevoluciones({});
      setMotivo("");
      setMensaje(`Confirmado por el servidor: ${resultado.id}`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se recibió confirmación.");
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
  async function prepararVenta() {
    if (bloqueo.current || pendiente || !listo) return;
    if (!seleccion.length) {
      setError("Selecciona una cantidad.");
      return;
    }
    for (const p of seleccion) {
      const n = Number(cantidades[p.productoId]);
      if (!Number.isInteger(n) || n > p.cantidadDisponible) {
        setError("Revisa las cantidades y el stock libre.");
        return;
      }
    }
    bloqueo.current = true;
    setOcupado(true);
    setError("");
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
          `${resumen}\n\nConsumidor final\nGPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}\nPrecisión: ±${Math.round(accuracy)} m\nCaptura puntual.`,
          "Confirmar entrega",
        )
      ) {
        validarVigenciaGPS(posicion.timestamp);
        bloqueo.current = false;
        await enviar(p);
      }
    } catch (e) {
      setError(
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
    if (!seleccion.length || !motivo.trim()) {
      setError("Selecciona lotes y describe el motivo de devolución.");
      return;
    }
    if (
      seleccion.some(
        (c) =>
          !Number.isInteger(Number(devoluciones[c.loteId])) ||
          Number(devoluciones[c.loteId]) > c.libre,
      )
    ) {
      setError("La devolución supera la custodia libre.");
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
      setError(e instanceof Error ? e.message : "No se pudo consultar.");
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  const deshabilitado = ocupado || !!pendiente || !listo;
  return (
    <View style={s.bloque}>
      <Text style={s.titulo}>Venta directa</Text>
      <Text style={s.descripcion}>
        Mercancía libre bajo tu custodia. Los productos de pedidos permanecen
        reservados.
      </Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {(["venta", "custodia", "historial"] as const).map((v) => (
          <Boton
            key={v}
            titulo={
              v === "venta"
                ? "Nueva venta"
                : v === "custodia"
                  ? "Cargas y devolución"
                  : "Historial"
            }
            onPress={() => {
              setVista(v);
              setError("");
            }}
            activo={vista === v}
          />
        ))}
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: "#a1322c", backgroundColor: "#fcefeb", padding: 12 }}
        >
          {error}
        </Text>
      ) : null}
      {mensaje ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: "#286344", padding: 12 }}
        >
          {mensaje}
        </Text>
      ) : null}
      {cargando || ocupado ? (
        <ActivityIndicator
          accessibilityLabel={
            ocupado ? "Procesando operación" : "Cargando inventario"
          }
        />
      ) : null}
      {pendiente ? (
        <View style={s.tarjeta}>
          <Text style={s.titulo}>Pendiente de verificar</Text>
          <Text>{pendiente.resumen}</Text>
          <Text style={s.descripcion}>
            La API todavía no confirmó el resultado. Reintentar utiliza la misma
            clave y recupera la operación si ya se registró.
          </Text>
          <Boton
            titulo="Verificar / reintentar"
            disabled={ocupado}
            onPress={() => void enviar(pendiente)}
          />
        </View>
      ) : null}
      <Boton
        titulo="Actualizar datos"
        disabled={ocupado}
        onPress={() => {
          setCargando(true);
          void cargar();
        }}
      />
      {vista === "venta" ? (
        <View style={s.bloque}>
          <TextInput
            accessibilityLabel="Buscar producto"
            style={s.input}
            placeholder="Buscar producto o presentación"
            value={busqueda}
            onChangeText={setBusqueda}
          />
          {stock
            .filter((p) =>
              `${p.nombre} ${p.codigo} ${p.presentacion}`
                .toLocaleLowerCase()
                .includes(busqueda.toLocaleLowerCase()),
            )
            .map((p) => (
              <View style={s.tarjeta} key={p.productoId}>
                <Text style={{ fontSize: 16, fontWeight: "700" }}>
                  {p.nombre}
                </Text>
                <Text>
                  {p.codigo} · {p.presentacion}
                </Text>
                <Text>{p.cantidadDisponible} unidades libres</Text>
                <TextInput
                  style={s.input}
                  accessibilityLabel={`Cantidad ${p.codigo}`}
                  placeholder="Cantidad"
                  keyboardType="number-pad"
                  value={cantidades[p.productoId] ?? ""}
                  editable={!deshabilitado}
                  onChangeText={(v) =>
                    setCantidades((c) => ({
                      ...c,
                      [p.productoId]: v.replace(/[^0-9]/g, ""),
                    }))
                  }
                />
              </View>
            ))}
          {!stock.length && !cargando ? (
            <Text>
              No tienes stock libre vendible. Revisa las cargas pendientes de
              recepción.
            </Text>
          ) : null}
          <View style={s.tarjeta}>
            <Text style={{ fontWeight: "700" }}>
              Resumen · Consumidor final
            </Text>
            {seleccion.map((p) => (
              <Text key={p.productoId}>
                {cantidades[p.productoId]} × {p.nombre} · {p.presentacion}
              </Text>
            ))}
            <Boton
              titulo="Obtener GPS y revisar entrega"
              disabled={deshabilitado || !seleccion.length}
              onPress={() => void prepararVenta()}
            />
          </View>
        </View>
      ) : null}
      {vista === "custodia" ? (
        <View style={s.bloque}>
          <Text style={{ fontSize: 18, fontWeight: "700" }}>Mi mercancía</Text>
          {custodia.map((c) => (
            <View style={s.tarjeta} key={`${c.loteId}-${c.finalidad}`}>
              <Text style={{ fontWeight: "700" }}>
                {c.nombre} · {c.presentacion}
              </Text>
              <Text>
                Lote {c.loteCodigo} · vence {c.venceEl.slice(0, 10)}
              </Text>
              <Text>
                {c.finalidad} · {c.cantidad} físicas · {c.libre} libres ·{" "}
                {c.pendiente} pendientes
              </Text>
              <Text>
                {c.condicion}
                {!c.elegible ? " · No vendible" : ""}
              </Text>
              {c.finalidad === "LIBRE" && c.libre > 0 ? (
                <TextInput
                  style={s.input}
                  accessibilityLabel={`Devolver lote ${c.loteCodigo}`}
                  keyboardType="number-pad"
                  placeholder="Cantidad a devolver"
                  editable={!deshabilitado}
                  value={devoluciones[c.loteId] ?? ""}
                  onChangeText={(v) =>
                    setDevoluciones((d) => ({
                      ...d,
                      [c.loteId]: v.replace(/[^0-9]/g, ""),
                    }))
                  }
                />
              ) : null}
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Boton
              titulo="Anterior"
              disabled={custodiaPage === 1 || ocupado}
              onPress={() => setCustodiaPage((p) => p - 1)}
            />
            <Text>Página {custodiaPage}</Text>
            <Boton
              titulo="Más lotes"
              disabled={custodia.length < 50 || ocupado}
              onPress={() => setCustodiaPage((p) => p + 1)}
            />
          </View>
          <TextInput
            style={[s.input, s.inputMultiline]}
            accessibilityLabel="Motivo de devolución"
            placeholder="Motivo y condición observada"
            multiline
            maxLength={300}
            editable={!deshabilitado}
            value={motivo}
            onChangeText={setMotivo}
          />
          <Boton
            titulo="Revisar devolución"
            disabled={deshabilitado}
            onPress={prepararDevolucion}
          />
          <Text style={s.descripcion}>
            Las devoluciones se reciben en inspección. No vuelven
            automáticamente a venta.
          </Text>
        </View>
      ) : null}
      {vista !== "venta" ? (
        <View style={s.bloque}>
          <Text style={{ fontSize: 18, fontWeight: "700" }}>
            Mis operaciones y cargas
          </Text>
          {historial.map((o) => (
            <View key={o.id} style={s.tarjeta}>
              <Text style={{ fontWeight: "700" }}>
                {o.tipo} · {o.estado}
              </Text>
              <Text>
                {fechaCorta(o.creadoEn)} · {o.unidades}{" "}
                unidades
              </Text>
              <Boton
                titulo="Ver detalle"
                onPress={async () => {
                  try {
                    setDetalle(await consultarOperacion(token, o.id));
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "No se pudo consultar.",
                    );
                  }
                }}
              />
              {o.tipo === "CARGA" && o.estado === "PENDIENTE_RECEPCION" ? (
                <Boton
                  titulo="Confirmar recepción"
                  disabled={deshabilitado}
                  onPress={() => void prepararRecepcion(o.id)}
                />
              ) : null}
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Boton
              titulo="Anterior"
              disabled={page === 1 || ocupado}
              onPress={() => setPage((p) => p - 1)}
            />
            <Text>
              {page} · {total} registros
            </Text>
            <Boton
              titulo="Siguiente"
              disabled={page * 20 >= total || ocupado}
              onPress={() => setPage((p) => p + 1)}
            />
          </View>
        </View>
      ) : null}
      {detalle ? (
        <View style={s.tarjeta}>
          <Text style={{ fontSize: 18, fontWeight: "700" }}>
            Detalle · {detalle.tipo}
          </Text>
          <Text selectable>{detalle.id}</Text>
          <Text>
            {detalle.responsable} · {detalle.estado}
          </Text>
          {detalle.latitud ? (
            <Text>
              GPS histórico: {detalle.latitud}, {detalle.longitud} · precisión{" "}
              {detalle.precisionM ?? "—"} m
            </Text>
          ) : null}
          {detalle.detalles.map((d) => (
            <View key={d.productoId}>
              <Text style={{ fontWeight: "700" }}>
                {d.cantidad} × {d.productoHistorico.nombre} ·{" "}
                {d.productoHistorico.presentacion}
              </Text>
              <Text>
                {d.precioUnitarioBob
                  ? `Bs ${d.precioUnitarioBob} por unidad al registrar`
                  : "Sin precio comercial validado"}
              </Text>
              {d.lotes.map((l) => (
                <Text key={l.loteId}>
                  Lote {l.codigo}: {l.cantidad} · {l.condicionAlRegistrar}
                </Text>
              ))}
            </View>
          ))}
          <Boton titulo="Cerrar detalle" onPress={() => setDetalle(null)} />
        </View>
      ) : null}
    </View>
  );
}
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

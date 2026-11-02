import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { OperacionDetalle } from "@/lib/operaciones-tipos";
import { fechaCorta } from "@/lib/distribucion";

const etiquetas: Record<string, string> = {
  SALIDA_DIRECTA: "Venta directa",
  CARGA: "Carga de mercancía",
  DEVOLUCION: "Devolución",
  REVERSION: "Devolución de venta",
  CONFIRMADA: "Confirmada",
  PENDIENTE_RECEPCION: "Por recibir",
  LIBERADO: "Apto para venta",
  BLOQUEADO: "Bloqueado",
  CUARENTENA: "En revisión",
};
export const nombreOperacion = (tipo: string) =>
  etiquetas[tipo] ?? tipo.toLowerCase().replaceAll("_", " ");
export function EstadoOperacion({
  estado,
  revertida = false,
}: {
  estado: string;
  revertida?: boolean;
}) {
  const espera = estado === "PENDIENTE_RECEPCION";
  return (
    <View
      style={[estilos.estado, espera ? estilos.espera : estilos.confirmada]}
    >
      <Text
        style={[estilos.estadoTexto, { color: espera ? "#795410" : "#286344" }]}
      >
        {revertida ? "Devuelta" : nombreOperacion(estado)}
      </Text>
    </View>
  );
}
export function DetalleOperacion({
  visible,
  detalle,
  cargando,
  error,
  cerrar,
}: {
  visible: boolean;
  detalle: OperacionDetalle | null;
  cargando: boolean;
  error: string;
  cerrar: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar}>
      <SafeAreaView style={estilos.pantalla} edges={["top", "bottom"]}>
        <View style={estilos.cabecera}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={estilos.etiqueta}>COMPROBANTE</Text>
            <Text style={estilos.titulo}>
              {detalle ? nombreOperacion(detalle.tipo) : "Detalle de operación"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar detalle"
            onPress={cerrar}
            style={estilos.cerrar}
          >
            <Text style={estilos.cerrarTexto}>Cerrar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={estilos.contenido}>
          {cargando && (
            <ActivityIndicator
              color="#b83b17"
              accessibilityLabel="Cargando detalle"
            />
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={estilos.error}>
              {error}
            </Text>
          )}
          {detalle && (
            <>
              <View style={estilos.tarjeta}>
                <EstadoOperacion
                  estado={detalle.estado}
                  revertida={!!detalle.reversionId}
                />
                <Text style={estilos.nombre}>
                  {detalle.clienteNombre ??
                    detalle.vendedorNombre ??
                    detalle.responsable}
                </Text>
                <Text style={estilos.secundario}>
                  {fechaCorta(detalle.creadoEn)}
                </Text>
                <Text style={estilos.secundario}>
                  Registrado por {detalle.responsable}
                </Text>
              </View>
              {detalle.detalles.map((d, i) => (
                <View key={d.productoId + "-" + i} style={estilos.tarjeta}>
                  <View style={estilos.fila}>
                    <Text style={estilos.cantidad}>{d.cantidad}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={estilos.nombre}>
                        {d.productoHistorico.nombre}
                      </Text>
                      <Text style={estilos.secundario}>
                        {d.productoHistorico.presentacion}
                      </Text>
                    </View>
                  </View>
                  {d.precioUnitarioBob !== null && (
                    <Text style={estilos.secundario}>
                      Bs {d.precioUnitarioBob} por unidad
                    </Text>
                  )}
                  {d.lotes.map((l, j) => (
                    <Text key={l.loteId + "-" + j} style={estilos.secundario}>
                      Lote {l.codigo} · {l.cantidad} unidades
                    </Text>
                  ))}
                </View>
              ))}
              {detalle.latitud !== null && (
                <View style={estilos.tarjeta}>
                  <Text style={estilos.nombre}>Lugar de entrega</Text>
                  <Text style={estilos.secundario}>
                    {detalle.latitud}, {detalle.longitud}
                  </Text>
                  {detalle.precisionM !== null && (
                    <Text style={estilos.secundario}>
                      Precisión: ±{Math.round(Number(detalle.precisionM))} m
                    </Text>
                  )}
                </View>
              )}
              {!!detalle.motivo && (
                <View style={estilos.tarjeta}>
                  <Text style={estilos.nombre}>Motivo</Text>
                  <Text>{detalle.motivo}</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#f6f5f0" },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    backgroundColor: "#20201e",
  },
  etiqueta: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#f2a488",
  },
  titulo: { fontSize: 22, fontWeight: "800", color: "#fff" },
  cerrar: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#66665e",
    borderRadius: 6,
  },
  cerrarTexto: { color: "#fff", fontWeight: "700" },
  contenido: { padding: 16, gap: 12 },
  tarjeta: {
    padding: 16,
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddddd5",
    borderRadius: 10,
  },
  estado: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  espera: { backgroundColor: "#fff5d9" },
  confirmada: { backgroundColor: "#eaf4ed" },
  estadoTexto: { fontWeight: "700", fontSize: 12 },
  nombre: { fontWeight: "700", fontSize: 16, color: "#20201e" },
  secundario: { color: "#66665e", fontSize: 13, lineHeight: 20 },
  fila: { flexDirection: "row", alignItems: "center", gap: 12 },
  cantidad: {
    backgroundColor: "#f8ebe5",
    color: "#a73a1d",
    padding: 12,
    fontWeight: "800",
    fontSize: 20,
    borderRadius: 8,
  },
  error: { padding: 14, backgroundColor: "#fcefeb", color: "#a1322c" },
});

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PedidoResumen } from '@/lib/tipos';

function fechaBolivia(valor: string) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function esHoyBolivia(valor: string) {
  const clave = (fecha: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(fecha);
  const fecha = new Date(valor);
  return !Number.isNaN(fecha.getTime()) && clave(fecha) === clave(new Date());
}

export function HistorialPedidosModal({
  visible,
  pedidos,
  cargando,
  mensaje,
  onCerrar,
}: {
  visible: boolean;
  pedidos: PedidoResumen[];
  cargando: boolean;
  mensaje?: string;
  onCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [periodo, setPeriodo] = useState<'HOY' | 'TODOS'>('TODOS');
  const [estado, setEstado] = useState<'ENTREGADO' | 'CANCELADO' | 'TODOS'>('ENTREGADO');

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es-BO');
    return pedidos.filter((pedido) => {
      const coincidePeriodo = periodo === 'TODOS' || esHoyBolivia(pedido.creadoEn);
      const coincideEstado = estado === 'TODOS' || pedido.estado === estado;
      const coincideBusqueda =
        !q ||
        pedido.cliente.nombre.toLocaleLowerCase('es-BO').includes(q) ||
        pedido.direccionEntrega.toLocaleLowerCase('es-BO').includes(q);
      return coincidePeriodo && coincideEstado && coincideBusqueda;
    });
  }, [busqueda, estado, pedidos, periodo]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
        <View style={styles.cabecera}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>PEDIDOS</Text>
            <Text style={styles.titulo}>Historial</Text>
            <Text style={styles.subtitulo}>
              Entregados y anulados quedan separados de la operación diaria.
            </Text>
          </View>
          <Pressable onPress={onCerrar} style={styles.cerrar}>
            <Text style={styles.cerrarTexto}>Cerrar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          <View style={styles.filtrosTarjeta}>
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar cliente o dirección"
              placeholderTextColor="#8a8982"
              style={styles.input}
            />
            <View style={styles.grid}>
              {[
                ['HOY', 'Hoy'],
                ['TODOS', 'Todo el historial'],
              ].map(([valor, texto]) => (
                <Pressable
                  key={valor}
                  onPress={() => setPeriodo(valor as 'HOY' | 'TODOS')}
                  style={[styles.filtro, styles.mitad, periodo === valor && styles.filtroActivo]}
                >
                  <Text style={[styles.filtroTexto, periodo === valor && styles.filtroTextoActivo]}>
                    {texto}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.filaWrap}>
              {[
                ['ENTREGADO', 'Entregados'],
                ['CANCELADO', 'Anulados'],
                ['TODOS', 'Todos'],
              ].map(([valor, texto]) => (
                <Pressable
                  key={valor}
                  onPress={() => setEstado(valor as 'ENTREGADO' | 'CANCELADO' | 'TODOS')}
                  style={[styles.filtro, estado === valor && styles.filtroActivo]}
                >
                  <Text style={[styles.filtroTexto, estado === valor && styles.filtroTextoActivo]}>
                    {texto}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.contador}>{filtrados.length} pedido(s) encontrados</Text>
          </View>

          {mensaje ? (
            <View style={styles.informacion}>
              <Text style={styles.informacionTitulo}>Información del historial</Text>
              <Text style={styles.informacionTexto}>{mensaje}</Text>
            </View>
          ) : null}

          {cargando ? (
            <View style={styles.cargando}>
              <ActivityIndicator color="#b83b17" />
              <Text style={styles.subtitulo}>Cargando historial…</Text>
            </View>
          ) : !filtrados.length ? (
            <View style={styles.vacio}>
              <Text style={styles.subtitulo}>No hay pedidos que coincidan con los filtros.</Text>
            </View>
          ) : (
            filtrados.map((pedido) => (
              <View
                key={pedido.id}
                style={[
                  styles.tarjeta,
                  pedido.estado === 'ENTREGADO' ? styles.entregado : styles.cancelado,
                ]}
              >
                <View style={styles.filaEntre}>
                  <View style={styles.flex}>
                    <Text style={styles.tarjetaTitulo}>{pedido.cliente.nombre}</Text>
                    <Text style={styles.subtitulo}>{fechaBolivia(pedido.creadoEn)}</Text>
                  </View>
                  <Text
                    style={[
                      styles.estado,
                      pedido.estado === 'ENTREGADO' ? styles.estadoEntregado : styles.estadoCancelado,
                    ]}
                  >
                    {pedido.estado === 'ENTREGADO' ? 'Entregado' : 'Anulado'}
                  </Text>
                </View>
                <Text style={styles.direccion}>{pedido.direccionEntrega}</Text>
                <View style={styles.resumen}>
                  <View>
                    <Text style={styles.etiqueta}>UNIDADES</Text>
                    <Text style={styles.valor}>{pedido.unidades}</Text>
                  </View>
                  <View>
                    <Text style={styles.etiqueta}>TOTAL</Text>
                    <Text style={styles.valor}>Bs {pedido.totalBob}</Text>
                  </View>
                </View>
                {pedido.estado === 'ENTREGADO' && pedido.entregadoEn ? (
                  <Text style={styles.confirmado}>Entregado · {fechaBolivia(pedido.entregadoEn)}</Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#f6f5f0' },
  cabecera: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddddd5',
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  flex: { flex: 1 },
  eyebrow: { color: '#b83b17', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  titulo: { color: '#20201e', fontSize: 24, fontWeight: '800', marginTop: 3 },
  subtitulo: { color: '#717169', fontSize: 12, lineHeight: 18, marginTop: 3 },
  cerrar: {
    borderWidth: 1,
    borderColor: '#b83b17',
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  cerrarTexto: { color: '#b83b17', fontSize: 12, fontWeight: '800' },
  contenido: { padding: 16, paddingBottom: 42, gap: 12 },
  filtrosTarjeta: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddddd5',
    borderRadius: 9,
    padding: 14,
    gap: 10,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    borderRadius: 7,
    paddingHorizontal: 12,
    color: '#262622',
    backgroundColor: '#fff',
    fontSize: 15,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  mitad: { flexBasis: '47%', flexGrow: 1, alignItems: 'center' },
  filtro: {
    borderWidth: 1,
    borderColor: '#c6c5bd',
    backgroundColor: '#fff',
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  filtroActivo: { borderColor: '#b83b17', backgroundColor: '#fdf0e9' },
  filtroTexto: { color: '#66665e', fontSize: 11, fontWeight: '700' },
  filtroTextoActivo: { color: '#b83b17' },
  contador: { color: '#717169', fontSize: 12 },
  informacion: {
    backgroundColor: '#f3f6f8',
    borderWidth: 1,
    borderColor: '#d7dfe4',
    borderRadius: 9,
    padding: 12,
    gap: 3,
  },
  informacionTitulo: { color: '#38464f', fontSize: 11, fontWeight: '900' },
  informacionTexto: { color: '#5c6870', fontSize: 12, lineHeight: 17 },
  cargando: { padding: 24, alignItems: 'center', gap: 8 },
  vacio: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#c6c5bd',
    borderRadius: 8,
    padding: 16,
  },
  tarjeta: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddddd5',
    borderRadius: 9,
    padding: 14,
    gap: 10,
    borderLeftWidth: 4,
  },
  entregado: { borderLeftColor: '#2d7a55' },
  cancelado: { borderLeftColor: '#8b817c' },
  filaEntre: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tarjetaTitulo: { color: '#262622', fontWeight: '800', fontSize: 15 },
  direccion: { color: '#50504a', fontSize: 13, lineHeight: 19 },
  estado: {
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  estadoEntregado: { color: '#286344', backgroundColor: '#eaf4ed' },
  estadoCancelado: { color: '#6f625d', backgroundColor: '#f1efed' },
  resumen: { flexDirection: 'row', gap: 30 },
  etiqueta: { color: '#717169', fontSize: 10, letterSpacing: 0.7 },
  valor: { color: '#262622', fontSize: 15, fontWeight: '800', marginTop: 2 },
  confirmado: {
    color: '#286344',
    backgroundColor: '#eaf4ed',
    padding: 9,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: '700',
  },
});

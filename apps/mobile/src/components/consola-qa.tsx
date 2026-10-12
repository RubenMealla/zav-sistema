import { useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { obtenerDireccionApi } from '@/lib/configuracion-api';
import {
  limpiarSolicitudesQa,
  obtenerSolicitudesQa,
  registrarSolicitudQa,
  suscribirSolicitudesQa,
} from '@/lib/diagnostico-qa';

type EstadoSalud = 'sin comprobar' | 'comprobando' | 'conectada' | 'no disponible';

export function ConsolaQa() {
  const [abierta, setAbierta] = useState(false);
  const [soloErrores, setSoloErrores] = useState(false);
  const [estadoSalud, setEstadoSalud] = useState<EstadoSalud>('sin comprobar');
  const [mensajeSalud, setMensajeSalud] = useState('Pulsa «Comprobar API» para verificar la conexión.');
  const solicitudes = useSyncExternalStore(
    suscribirSolicitudesQa,
    obtenerSolicitudesQa,
    obtenerSolicitudesQa,
  );

  const totalErrores = solicitudes.filter((registro) => !registro.correcta).length;
  const visibles = soloErrores
    ? solicitudes.filter((registro) => !registro.correcta)
    : solicitudes;
  const base = obtenerDireccionApi();

  async function comprobarApi() {
    setEstadoSalud('comprobando');
    const inicio = Date.now();
    let codigo = 0;
    let correcta = false;
    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), 8000);
    try {
      if (!base) throw new Error('Configura la dirección de la API desde el acceso.');
      const respuesta = await fetch(base + '/api/v1/salud', { signal: controlador.signal });
      codigo = respuesta.status;
      const cuerpo: unknown = await respuesta.json();
      if (!respuesta.ok || !cuerpo || typeof cuerpo !== 'object' ||
          (cuerpo as { estado?: unknown }).estado !== 'ok') {
        throw new Error('El servidor no respondió con el estado esperado.');
      }
      correcta = true;
      setEstadoSalud('conectada');
      setMensajeSalud('API ZAV disponible · HTTP ' + respuesta.status);
    } catch (error) {
      setEstadoSalud('no disponible');
      setMensajeSalud(error instanceof Error && error.name === 'AbortError'
        ? 'Tiempo de espera agotado (8 segundos).'
        : 'No se pudo comprobar la API. Revisa la dirección, la Wi-Fi y NestJS.');
    } finally {
      clearTimeout(timeout);
      registrarSolicitudQa({
        metodo: 'GET',
        ruta: '/api/v1/salud',
        codigo,
        correcta,
        duracionMs: Date.now() - inicio,
      });
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir consola QA"
        onPress={() => setAbierta(true)}
        style={[styles.burbuja, totalErrores > 0 && styles.burbujaError]}
      >
        <Text style={styles.burbujaTexto}>QA</Text>
        {totalErrores > 0 ? (
          <View style={styles.contador}><Text style={styles.contadorTexto}>{totalErrores}</Text></View>
        ) : null}
      </Pressable>
      <Modal visible={abierta} animationType="slide" onRequestClose={() => setAbierta(false)}>
        <SafeAreaView style={styles.pantalla}>
          <View style={styles.encabezado}>
            <View style={styles.encabezadoTexto}>
              <Text style={styles.titulo}>Consola de pruebas</Text>
              <Text style={styles.subtitulo}>Solo ZAV Vendedor QA · hasta 80 solicitudes</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setAbierta(false)} style={styles.cerrar}>
              <Text style={styles.cerrarTexto}>Cerrar</Text>
            </Pressable>
          </View>
          <View style={styles.estado}>
            <Text style={styles.etiqueta}>SERVIDOR CONFIGURADO</Text>
            <Text selectable style={styles.direccion}>{base || 'Sin configurar'}</Text>
            <Text style={styles.detalle}>Estado: {estadoSalud}</Text>
            <Text style={styles.detalle}>{mensajeSalud}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={estadoSalud === 'comprobando'}
              onPress={() => { void comprobarApi(); }}
              style={styles.boton}
            >
              {estadoSalud === 'comprobando' ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.botonTexto}>Comprobar API</Text>
              )}
            </Pressable>
          </View>
          <View style={styles.filtros}>
            <Text style={styles.resumen}>Solicitudes: {solicitudes.length} · Errores: {totalErrores}</Text>
            <View style={styles.acciones}>
              <Pressable accessibilityRole="button" onPress={() => setSoloErrores(!soloErrores)}>
                <Text style={styles.enlace}>{soloErrores ? 'Ver todas' : 'Solo errores'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={limpiarSolicitudesQa}>
                <Text style={styles.enlace}>Limpiar</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.lista} contentContainerStyle={styles.listaContenido}>
            {visibles.length === 0 ? (
              <Text style={styles.vacio}>
                No hay {soloErrores ? 'errores registrados' : 'solicitudes registradas'}.
                Las peticiones aparecerán aquí conforme uses la aplicación.
              </Text>
            ) : visibles.map((registro) => (
              <View key={registro.id} style={[styles.registro, !registro.correcta && styles.registroError]}>
                <View style={styles.fila}>
                  <Text style={styles.metodo}>{registro.metodo}</Text>
                  <Text style={[styles.codigo, !registro.correcta && styles.codigoError]}>
                    {registro.codigo === 0 ? 'Sin respuesta' : 'HTTP ' + registro.codigo}
                  </Text>
                  <Text style={styles.duracion}>{registro.duracionMs} ms</Text>
                </View>
                <Text selectable style={styles.ruta}>{registro.ruta}</Text>
                <Text style={styles.detalle}>
                  {registro.correcta ? 'Petición completada' :
                    registro.codigo === 0 ? 'Error de conexión o respuesta' : 'El servidor rechazó la petición'}
                  {' · '}{registro.momento.slice(11, 19)} UTC
                </Text>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.privacidad}>
            Diagnóstico en memoria. No se guardan contraseñas, tokens, cuerpos de solicitudes ni datos de clientes.
          </Text>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  burbuja: {
    position: 'absolute', right: 14, bottom: 18, zIndex: 1000,
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#26302d', elevation: 9,
  },
  burbujaError: { backgroundColor: '#9c3423' },
  burbujaTexto: { color: '#fff', fontSize: 15, fontWeight: '800' },
  contador: {
    position: 'absolute', top: -5, right: -5, minWidth: 21, height: 21,
    paddingHorizontal: 3, borderRadius: 11, backgroundColor: '#f2bc54',
    alignItems: 'center', justifyContent: 'center',
  },
  contadorTexto: { color: '#23201a', fontSize: 11, fontWeight: '800' },
  pantalla: { flex: 1, backgroundColor: '#f6f5f0' },
  encabezado: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
  encabezadoTexto: { flex: 1, gap: 4 },
  titulo: { color: '#21211f', fontSize: 20, fontWeight: '800' },
  subtitulo: { color: '#66665f', fontSize: 12 },
  cerrar: { padding: 10, borderWidth: 1, borderColor: '#d9d8d0', borderRadius: 6 },
  cerrarTexto: { color: '#33312e', fontWeight: '700' },
  estado: {
    marginHorizontal: 14, padding: 14, gap: 7,
    borderWidth: 1, borderColor: '#d8d7cf', borderRadius: 8, backgroundColor: '#fff',
  },
  etiqueta: { color: '#a44629', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  direccion: { color: '#252522', fontSize: 13 },
  detalle: { color: '#64645d', fontSize: 11, lineHeight: 17 },
  boton: { backgroundColor: '#292824', borderRadius: 6, minHeight: 43, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  botonTexto: { color: '#fff', fontSize: 13, fontWeight: '800' },
  filtros: {
    paddingHorizontal: 16, paddingVertical: 13, gap: 7,
    borderBottomWidth: 1, borderColor: '#deddd6',
  },
  resumen: { color: '#34332f', fontWeight: '800', fontSize: 13 },
  acciones: { flexDirection: 'row', justifyContent: 'space-between' },
  enlace: { color: '#9d3f22', fontWeight: '700', fontSize: 13, paddingVertical: 4 },
  lista: { flex: 1 },
  listaContenido: { padding: 14, gap: 8 },
  vacio: { textAlign: 'center', color: '#727169', paddingVertical: 30, lineHeight: 21 },
  registro: { borderRadius: 7, borderWidth: 1, borderColor: '#dfded8', backgroundColor: '#fff', padding: 11, gap: 6 },
  registroError: { borderColor: '#e4afa1', backgroundColor: '#fff8f4' },
  fila: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  metodo: { fontSize: 11, color: '#252522', fontWeight: '900', minWidth: 46 },
  codigo: { color: '#227c48', fontWeight: '800', fontSize: 12 },
  codigoError: { color: '#a13a28' },
  duracion: { color: '#62615d', fontSize: 11, marginLeft: 'auto' },
  ruta: { color: '#34332f', fontSize: 12, fontWeight: '700' },
  privacidad: { color: '#77746c', fontSize: 11, lineHeight: 16, paddingHorizontal: 16, paddingVertical: 11 },
});

import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { GoogleMaps } from 'expo-maps';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {
  PlanificacionParada,
  PuntoGeografico,
} from '@/lib/tipos';

const MAPS_CONFIGURED = Constants.expoConfig?.extra?.mapsConfigured === true;

type SelectorProps = {
  visible: boolean;
  direccionInicial: string;
  puntoInicial: PuntoGeografico | null;
  onCancelar: () => void;
  onConfirmar: (valor: PuntoGeografico & { direccion: string }) => void;
};

async function permisoForeground() {
  const actual = await Location.getForegroundPermissionsAsync();
  if (actual.status === 'granted') return true;
  const solicitado = await Location.requestForegroundPermissionsAsync();
  return solicitado.status === 'granted';
}

function direccionLegible(direccion: Location.LocationGeocodedAddress | undefined) {
  if (!direccion) return '';
  return [
    direccion.name,
    direccion.street,
    direccion.district,
    direccion.city,
    direccion.region,
  ]
    .filter(Boolean)
    .filter((valor, indice, todos) => todos.indexOf(valor) === indice)
    .join(', ');
}

export function SelectorUbicacionMapa({
  visible,
  direccionInicial,
  puntoInicial,
  onCancelar,
  onConfirmar,
}: SelectorProps) {
  const [direccion, setDireccion] = useState(direccionInicial);
  const [punto, setPunto] = useState<PuntoGeografico | null>(puntoInicial);
  const [versionMapa, setVersionMapa] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function buscarDireccion() {
    if (!direccion.trim()) {
      setError('Escribe una dirección para buscarla.');
      return;
    }
    setCargando(true);
    setError('');
    try {
      if (Platform.OS === 'android' && !(await permisoForeground())) {
        setError('Android requiere permiso de ubicación para buscar direcciones.');
        return;
      }
      const resultados = await Location.geocodeAsync(direccion.trim());
      if (!resultados.length) {
        setError('No se encontró esa dirección. Puedes corregir el texto e intentar otra vez.');
        return;
      }
      const nuevo = {
        latitud: resultados[0].latitude,
        longitud: resultados[0].longitude,
      };
      setPunto(nuevo);
      setVersionMapa((actual) => actual + 1);
    } catch {
      setError('No se pudo buscar la dirección en este momento.');
    } finally {
      setCargando(false);
    }
  }

  async function usarUbicacionActual() {
    setCargando(true);
    setError('');
    try {
      if (!(await permisoForeground())) {
        setError('No se autorizó la ubicación. La selección puede hacerse buscando una dirección.');
        return;
      }

      const posicion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const nuevo = {
        latitud: posicion.coords.latitude,
        longitud: posicion.coords.longitude,
      };
      setPunto(nuevo);
      setVersionMapa((actual) => actual + 1);

      const reversa = await Location.reverseGeocodeAsync({
        latitude: nuevo.latitud,
        longitude: nuevo.longitud,
      });
      const sugerida = direccionLegible(reversa[0]);
      if (sugerida) setDireccion(sugerida);
    } catch {
      setError('No se pudo obtener la ubicación actual.');
    } finally {
      setCargando(false);
    }
  }

  async function confirmar() {
    if (!punto) {
      setError('Primero selecciona un punto.');
      return;
    }
    let direccionFinal = direccion.trim();
    if (!direccionFinal) {
      try {
        if (await permisoForeground()) {
          const reversa = await Location.reverseGeocodeAsync({
            latitude: punto.latitud,
            longitude: punto.longitud,
          });
          direccionFinal = direccionLegible(reversa[0]);
        }
      } catch {
        // La geocodificación inversa es auxiliar: el punto sigue siendo válido.
      }
    }
    if (!direccionFinal) {
      setError('Confirma también una dirección textual para el punto.');
      return;
    }
    onConfirmar({ ...punto, direccion: direccionFinal });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancelar}>
      <View style={styles.modal}>
        <View style={styles.cabecera}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>UBICACIÓN DE ENTREGA</Text>
            <Text style={styles.titulo}>Confirmar punto en mapa</Text>
          </View>
          <Pressable onPress={onCancelar} style={styles.secundarioCompacto}>
            <Text style={styles.secundarioTexto}>Cerrar</Text>
          </Pressable>
        </View>

        <View style={styles.busqueda}>
          <Text style={styles.label}>Dirección</Text>
          <TextInput
            value={direccion}
            onChangeText={setDireccion}
            placeholder="Escribe una dirección o referencia"
            placeholderTextColor="#8a8982"
            style={styles.input}
          />
          <View style={styles.fila}>
            <Pressable onPress={() => void buscarDireccion()} style={styles.secundario}>
              <Text style={styles.secundarioTextoOscuro}>Buscar dirección</Text>
            </Pressable>
            <Pressable onPress={() => void usarUbicacionActual()} style={styles.secundario}>
              <Text style={styles.secundarioTextoOscuro}>Mi ubicación</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {cargando ? (
          <View style={styles.cargando}>
            <ActivityIndicator color="#b83b17" />
            <Text style={styles.ayuda}>Obteniendo ubicación…</Text>
          </View>
        ) : null}

        {punto && MAPS_CONFIGURED ? (
          <View style={styles.mapaContenedor}>
            <GoogleMaps.View
              key={versionMapa}
              style={styles.mapa}
              cameraPosition={{
                coordinates: {
                  latitude: punto.latitud,
                  longitude: punto.longitud,
                },
                zoom: 17,
              }}
              onCameraMove={(evento) => {
                if (
                  typeof evento.coordinates.latitude === 'number' &&
                  typeof evento.coordinates.longitude === 'number'
                ) {
                  setPunto({
                    latitud: evento.coordinates.latitude,
                    longitud: evento.coordinates.longitude,
                  });
                }
              }}
              uiSettings={{
                compassEnabled: true,
                zoomControlsEnabled: true,
                zoomGesturesEnabled: true,
                scrollGesturesEnabled: true,
                rotationGesturesEnabled: false,
                tiltGesturesEnabled: false,
                mapToolbarEnabled: false,
                myLocationButtonEnabled: false,
              }}
            />
            <View pointerEvents="none" style={styles.cruz}>
              <View style={styles.pin} />
              <View style={styles.pinPunta} />
            </View>
            <View style={styles.coordenadas}>
              <Text style={styles.coordenadasTexto}>
                {punto.latitud.toFixed(6)}, {punto.longitud.toFixed(6)}
              </Text>
              <Text style={styles.ayuda}>Mueve el mapa hasta dejar el marcador sobre el destino.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.sinMapa}>
            <Text style={styles.ayuda}>
              {punto && !MAPS_CONFIGURED
                ? 'El punto fue obtenido, pero Maps SDK no está configurado en este APK. No lo uses como evidencia final.'
                : 'Busca una dirección o usa tu ubicación actual para abrir el mapa. Nada se guarda hasta confirmar.'}
            </Text>
          </View>
        )}

        <View style={styles.pie}>
          <Pressable onPress={onCancelar} style={styles.secundario}>
            <Text style={styles.secundarioTextoOscuro}>Cancelar</Text>
          </Pressable>
          <Pressable onPress={() => void confirmar()} style={styles.primario}>
            <Text style={styles.primarioTexto}>Confirmar ubicación</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

type MapaRepartoProps = {
  origen: PuntoGeografico;
  paradas: PlanificacionParada[];
};

export function MapaReparto({ origen, paradas }: MapaRepartoProps) {
  const coordenadas = useMemo(
    () => [
      { latitude: origen.latitud, longitude: origen.longitud },
      ...paradas.map((p) => ({ latitude: p.latitud, longitude: p.longitud })),
    ],
    [origen, paradas],
  );

  if (!paradas.length) return null;
  if (!MAPS_CONFIGURED) {
    return (
      <View style={styles.sinMapa}>
        <Text style={styles.ayuda}>
          Maps SDK no está configurado en este APK; la secuencia textual sigue disponible.
        </Text>
      </View>
    );
  }

  const centro = {
    latitud:
      coordenadas.reduce((suma, p) => suma + (p.latitude ?? 0), 0) / coordenadas.length,
    longitud:
      coordenadas.reduce((suma, p) => suma + (p.longitude ?? 0), 0) / coordenadas.length,
  };

  return (
    <View style={styles.mapaPlan}>
      <GoogleMaps.View
        style={StyleSheet.absoluteFill}
        cameraPosition={{
          coordinates: { latitude: centro.latitud, longitude: centro.longitud },
          zoom: 12,
        }}
        markers={[
          {
            id: 'origen',
            coordinates: { latitude: origen.latitud, longitude: origen.longitud },
            title: 'Origen',
            snippet: 'Inicio del reparto',
          },
          ...paradas.map((p) => ({
            id: p.pedidoId,
            coordinates: { latitude: p.latitud, longitude: p.longitud },
            title: `${p.orden}. ${p.clienteNombre}`,
            snippet: p.direccionEntrega,
          })),
        ]}
        polylines={[
          {
            id: 'secuencia',
            coordinates: coordenadas,
            geodesic: true,
            width: 5,
          },
        ]}
        uiSettings={{
          compassEnabled: true,
          zoomControlsEnabled: true,
          zoomGesturesEnabled: true,
          scrollGesturesEnabled: true,
          rotationGesturesEnabled: false,
          tiltGesturesEnabled: false,
          mapToolbarEnabled: false,
          myLocationButtonEnabled: false,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#f6f5f0' },
  cabecera: {
    backgroundColor: '#20201e',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: { flex: 1 },
  eyebrow: {
    color: '#f2a488',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  titulo: { color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 3 },
  busqueda: { padding: 16, gap: 8 },
  label: { color: '#50504a', fontSize: 12, fontWeight: '700' },
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
  fila: { flexDirection: 'row', gap: 8 },
  secundario: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    backgroundColor: '#fff',
    borderRadius: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  secundarioCompacto: {
    borderWidth: 1,
    borderColor: '#66665e',
    borderRadius: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  secundarioTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },
  secundarioTextoOscuro: { color: '#50504a', fontSize: 12, fontWeight: '800' },
  error: {
    marginHorizontal: 16,
    marginBottom: 8,
    color: '#a1322c',
    backgroundColor: '#fcefeb',
    padding: 10,
    borderRadius: 6,
  },
  cargando: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapaContenedor: { flex: 1, marginHorizontal: 16, overflow: 'hidden', borderRadius: 10 },
  mapa: { flex: 1 },
  cruz: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 28,
    height: 36,
    marginLeft: -14,
    marginTop: -31,
    alignItems: 'center',
  },
  pin: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#b83b17',
    borderWidth: 4,
    borderColor: '#fff',
  },
  pinPunta: {
    width: 8,
    height: 8,
    backgroundColor: '#b83b17',
    transform: [{ rotate: '45deg' }],
    marginTop: -5,
  },
  coordenadas: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 7,
    padding: 9,
  },
  coordenadasTexto: { color: '#262622', fontSize: 12, fontWeight: '800' },
  ayuda: { color: '#717169', fontSize: 11, lineHeight: 16 },
  sinMapa: {
    flex: 1,
    marginHorizontal: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#c6c5bd',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pie: { flexDirection: 'row', gap: 8, padding: 16 },
  primario: {
    minHeight: 44,
    borderRadius: 7,
    backgroundColor: '#b83b17',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  primarioTexto: { color: '#fff', fontSize: 12, fontWeight: '800' },
  mapaPlan: {
    height: 300,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddddd5',
  },
});

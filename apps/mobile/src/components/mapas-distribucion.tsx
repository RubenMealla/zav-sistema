import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
} from '@maplibre/maplibre-react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  autocompletarDirecciones,
  buscarDirecciones,
  direccionInversa,
} from '@/lib/api';
import type {
  DireccionGeocodificada,
} from '@/lib/api';
import type {
  PlanificacionParada,
  PuntoGeografico,
} from '@/lib/tipos';

const MAP_STYLE_URL =
  (Constants.expoConfig?.extra?.mapStyleUrl as string | undefined) ??
  'https://tiles.openfreemap.org/styles/liberty';

const CENTRO_TARIJA_REFERENCIAL: PuntoGeografico = {
  latitud: -21.5355,
  longitud: -64.7296,
};

type SelectorProps = {
  visible: boolean;
  token: string;
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

function esPlusCode(valor: string) {
  return /^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}$/i.test(valor.trim());
}

function limpiarDireccion(valor: string) {
  return valor
    .replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4},?\s*/i, '')
    .trim();
}

function direccionLegible(direccion: Location.LocationGeocodedAddress | undefined) {
  if (!direccion) return '';
  const nombre =
    direccion.name && !esPlusCode(direccion.name) ? direccion.name : null;
  return [
    nombre,
    direccion.street,
    direccion.district,
    direccion.subregion,
    direccion.city,
    direccion.region,
  ]
    .filter(Boolean)
    .filter((valor, indice, todos) => todos.indexOf(valor) === indice)
    .join(', ');
}

export function SelectorUbicacionMapa({
  visible,
  token,
  direccionInicial,
  puntoInicial,
  onCancelar,
  onConfirmar,
}: SelectorProps) {
  const direccionLimpiaInicial = limpiarDireccion(direccionInicial);
  const [direccion, setDireccion] = useState(direccionLimpiaInicial);
  const [direccionElegida, setDireccionElegida] = useState<string | null>(
    direccionLimpiaInicial || null,
  );
  const [punto, setPunto] = useState<PuntoGeografico | null>(puntoInicial);
  const [versionMapa, setVersionMapa] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [sugerencias, setSugerencias] = useState<DireccionGeocodificada[]>([]);
  const [buscandoSugerencias, setBuscandoSugerencias] = useState(false);
  const [mapaListo, setMapaListo] = useState(false);
  const [error, setError] = useState('');

  function permiteFallback(errorActual: unknown) {
    return (
      errorActual instanceof ApiError &&
      (errorActual.status === 0 ||
        errorActual.status === 404 ||
        errorActual.status === 503)
    );
  }

  useEffect(() => {
    if (!visible) return;
    const consulta = direccion.trim();
    if (consulta.length < 2 || consulta === direccionElegida) return;

    let activa = true;
    const temporizador = setTimeout(() => {
      setBuscandoSugerencias(true);
      void autocompletarDirecciones(token, consulta)
        .then((respuesta) => {
          if (!activa) return;
          setSugerencias(respuesta.resultados);
        })
        .catch(() => {
          if (activa) setSugerencias([]);
        })
        .finally(() => {
          if (activa) setBuscandoSugerencias(false);
        });
    }, 350);

    return () => {
      activa = false;
      clearTimeout(temporizador);
    };
  }, [direccion, direccionElegida, token, visible]);

  async function resolverDireccionInversa(valor: PuntoGeografico) {
    try {
      const remota = await direccionInversa(token, valor);
      if (remota.direccion) return limpiarDireccion(remota.direccion);
    } catch (e) {
      if (!permiteFallback(e)) throw e;
    }

    if (Platform.OS === 'android' && !(await permisoForeground())) return '';
    const reversa = await Location.reverseGeocodeAsync({
      latitude: valor.latitud,
      longitude: valor.longitud,
    });
    const local = reversa[0];
    const contextoTarija = [local?.region, local?.subregion, local?.city, local?.district]
      .filter(Boolean)
      .some((texto) => String(texto).toLocaleLowerCase('es-BO').includes('tarija'));
    if (!contextoTarija) {
      throw new Error('FUERA_DE_TARIJA');
    }
    return direccionLegible(local);
  }

  function elegirSugerencia(elegida: DireccionGeocodificada) {
    const direccionVisible = limpiarDireccion(elegida.direccion);
    setDireccion(direccionVisible);
    setDireccionElegida(direccionVisible);
    setSugerencias([]);
    setPunto({
      latitud: elegida.latitud,
      longitud: elegida.longitud,
    });
    setMapaListo(false);
    setVersionMapa((actual) => actual + 1);
    setError('');
  }

  async function buscarDireccion() {
    const consulta = direccion.trim();
    if (!consulta) {
      setError('Escribe una dirección, calle, barrio o referencia.');
      return;
    }

    if (sugerencias.length) {
      elegirSugerencia(sugerencias[0]);
      return;
    }

    setCargando(true);
    setError('');
    try {
      const remotos = await buscarDirecciones(token, consulta);
      if (!remotos.resultados.length) {
        setError(
          'No se encontró esa referencia dentro del departamento de Tarija. Prueba con el barrio, calle, zona o una referencia más completa.',
        );
        return;
      }
      elegirSugerencia(remotos.resultados[0]);
    } catch {
      setError(
        'No se pudo consultar direcciones en este momento. Puedes usar “Mi ubicación” y corregir el punto manualmente.',
      );
    } finally {
      setCargando(false);
    }
  }

  async function usarUbicacionActual() {
    setCargando(true);
    setError('');
    try {
      if (!(await permisoForeground())) {
        setError(
          'No se autorizó la ubicación. Puedes buscar una dirección sin compartir tu posición.',
        );
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
      setMapaListo(false);
      setVersionMapa((actual) => actual + 1);

      const sugerida = await resolverDireccionInversa(nuevo);
      if (sugerida) {
        setDireccion(sugerida);
        setDireccionElegida(sugerida);
      }
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'No se pudo obtener la ubicación actual.',
      );
    } finally {
      setCargando(false);
    }
  }

  async function confirmar() {
    if (!punto) {
      setError('Primero selecciona un punto dentro del departamento de Tarija.');
      return;
    }

    setCargando(true);
    setError('');
    try {
      const direccionMapa = await resolverDireccionInversa(punto);
      const direccionEscrita = limpiarDireccion(direccion.trim());
      const direccionFinal =
        direccionMapa ||
        (direccionEscrita && !esPlusCode(direccionEscrita)
          ? direccionEscrita
          : '');

      if (!direccionFinal) {
        setError(
          'Escribe una dirección o referencia comprensible antes de confirmar el punto.',
        );
        return;
      }

      onConfirmar({ ...punto, direccion: direccionFinal });
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'No se pudo validar el punto seleccionado.',
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancelar}>
      <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
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
          <Text style={styles.label}>Dirección o referencia</Text>
          <TextInput
            value={direccion}
            onChangeText={(valor) => {
              setDireccion(valor);
              setDireccionElegida(null);
              if (valor.trim().length < 2) setSugerencias([]);
              setError('');
            }}
            autoCorrect={false}
            placeholder="Ej. Senac, Calle La Cruz, barrio..."
            placeholderTextColor="#8a8982"
            style={styles.input}
          />

          {buscandoSugerencias ? (
            <View style={styles.sugerenciasEstado}>
              <ActivityIndicator size="small" color="#b83b17" />
              <Text style={styles.ayuda}>Buscando únicamente en Tarija, Bolivia…</Text>
            </View>
          ) : null}

          {sugerencias.length ? (
            <View style={styles.sugerencias}>
              <Text style={styles.sugerenciasTitulo}>
                Coincidencias en Tarija, Bolivia
              </Text>
              {sugerencias.map((sugerencia, indice) => (
                <Pressable
                  key={`${sugerencia.latitud}:${sugerencia.longitud}:${indice}`}
                  onPress={() => elegirSugerencia(sugerencia)}
                  style={styles.sugerencia}
                >
                  <Text style={styles.sugerenciaPrincipal}>
                    {sugerencia.principal || sugerencia.direccion}
                  </Text>
                  {sugerencia.secundaria ? (
                    <Text style={styles.sugerenciaSecundaria}>
                      {sugerencia.secundaria}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.fila}>
            <Pressable onPress={() => void buscarDireccion()} style={styles.secundario}>
              <Text style={styles.secundarioTextoOscuro}>Buscar</Text>
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
            <Text style={styles.ayuda}>Validando ubicación…</Text>
          </View>
        ) : null}

        <View style={styles.mapaContenedor}>
          <Map
            key={versionMapa}
            style={styles.mapa}
            mapStyle={MAP_STYLE_URL}
            androidView="texture"
            attribution
            touchRotate={false}
            touchPitch={false}
            onWillStartLoadingMap={() => setMapaListo(false)}
            onDidFinishLoadingMap={() => setMapaListo(true)}
            onDidFailLoadingMap={() => {
              setMapaListo(false);
              setError(
                'El mapa no pudo cargarse. Revisa la conexión y vuelve a intentar.',
              );
            }}
            onRegionDidChange={(evento) => {
              if (!punto) return;
              const [longitud, latitud] = evento.nativeEvent.center;
              if (Number.isFinite(latitud) && Number.isFinite(longitud)) {
                setPunto({ latitud, longitud });
              }
            }}
          >
            <Camera
              initialViewState={{
                center: [
                  (punto ?? CENTRO_TARIJA_REFERENCIAL).longitud,
                  (punto ?? CENTRO_TARIJA_REFERENCIAL).latitud,
                ],
                zoom: punto ? 17 : 12,
              }}
            />
          </Map>

          {!mapaListo ? (
            <View pointerEvents="none" style={styles.mapaCargando}>
              <ActivityIndicator color="#b83b17" />
              <Text style={styles.ayuda}>Cargando mapa de Tarija…</Text>
            </View>
          ) : null}

          {punto ? (
            <View pointerEvents="none" style={styles.cruz}>
              <View style={styles.pin} />
              <View style={styles.pinPunta} />
            </View>
          ) : null}

          <View style={styles.coordenadas}>
            <Text style={styles.coordenadasTexto}>
              {punto ? 'Punto seleccionado' : 'Mapa de referencia · Tarija'}
            </Text>
            <Text style={styles.ayuda}>
              {punto
                ? 'Puedes mover el mapa para ajustar el destino. Al confirmar, la dirección se actualizará según el punto final.'
                : 'Busca una dirección o usa “Mi ubicación” para fijar el punto de entrega.'}
            </Text>
          </View>
        </View>

        <View style={styles.pie}>
          <Pressable onPress={onCancelar} style={styles.secundario}>
            <Text style={styles.secundarioTextoOscuro}>Cancelar</Text>
          </Pressable>
          <Pressable
            disabled={!punto || cargando}
            onPress={() => void confirmar()}
            style={[styles.primario, (!punto || cargando) && styles.deshabilitado]}
          >
            <Text style={styles.primarioTexto}>Confirmar ubicación</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

type MapaRepartoProps = {
  origen: PuntoGeografico | null;
  paradas: PlanificacionParada[];
  interactivo?: boolean;
  expandido?: boolean;
  enfoquePedidoId?: string | null;
  onEnfocarPedido?: (pedidoId: string) => void;
};

function offsetVisualParada(orden: number): [number, number] {
  const angulo = ((orden * 137.508) * Math.PI) / 180;
  const radio = 12 + ((orden - 1) % 3) * 3;
  return [
    Math.round(Math.cos(angulo) * radio),
    Math.round(Math.sin(angulo) * radio),
  ];
}

export function MapaReparto({
  origen,
  paradas,
  interactivo = false,
  expandido = false,
  enfoquePedidoId = null,
  onEnfocarPedido,
}: MapaRepartoProps) {
  const coordenadas = useMemo(
    () =>
      [
        ...(origen ? [[origen.longitud, origen.latitud] as [number, number]] : []),
        ...paradas.map((p) => [p.longitud, p.latitud] as [number, number]),
      ],
    [origen, paradas],
  );

  const paradaEnfocada = useMemo(
    () => paradas.find((parada) => parada.pedidoId === enfoquePedidoId) ?? null,
    [enfoquePedidoId, paradas],
  );

  const linea = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: coordenadas,
      },
    }),
    [coordenadas],
  );

  const limites = useMemo(() => {
    const longitudes = coordenadas.map(([lon]) => lon);
    const latitudes = coordenadas.map(([, lat]) => lat);
    return [
      Math.min(...longitudes),
      Math.min(...latitudes),
      Math.max(...longitudes),
      Math.max(...latitudes),
    ] as [number, number, number, number];
  }, [coordenadas]);

  const camaraInicial = useMemo(() => {
    if (paradaEnfocada) {
      return {
        center: [paradaEnfocada.longitud, paradaEnfocada.latitud] as [number, number],
        zoom: 16.5,
        padding: { top: 64, right: 44, bottom: 64, left: 44 },
      };
    }

    if (coordenadas.length === 1) {
      return {
        center: coordenadas[0],
        zoom: 16,
        padding: { top: 52, right: 44, bottom: 52, left: 44 },
      };
    }

    return {
      bounds: limites,
      padding: { top: 52, right: 44, bottom: 52, left: 44 },
    };
  }, [coordenadas, limites, paradaEnfocada]);

  if (!paradas.length) return null;

  return (
    <View
      pointerEvents={interactivo ? 'auto' : 'none'}
      style={[styles.mapaPlan, expandido && styles.mapaPlanExpandido]}
    >
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_URL}
        attribution
        touchRotate={false}
        touchPitch={false}
      >
        <Camera initialViewState={camaraInicial} />

        {coordenadas.length >= 2 ? (
          <GeoJSONSource id="secuencia-reparto" data={linea}>
            <Layer
              id="secuencia-reparto-linea"
              type="line"
              paint={{
                'line-color': '#b83b17',
                'line-width': 4,
                'line-opacity': 0.78,
              } as never}
            />
          </GeoJSONSource>
        ) : null}

        {origen ? (
          <Marker id="origen" lngLat={[origen.longitud, origen.latitud]}>
            <View style={[styles.marcador, styles.marcadorOrigen]}>
              <Text style={styles.marcadorTexto}>Z</Text>
            </View>
          </Marker>
        ) : null}

        {paradas.map((parada) => {
          const enfocada = parada.pedidoId === enfoquePedidoId;
          return (
            <Marker
              key={parada.pedidoId}
              id={parada.pedidoId}
              lngLat={[parada.longitud, parada.latitud]}
              offset={offsetVisualParada(parada.orden)}
              onPress={
                interactivo && onEnfocarPedido
                  ? () => onEnfocarPedido(parada.pedidoId)
                  : undefined
              }
            >
              <View
                style={[
                  styles.marcador,
                  enfocada && styles.marcadorEnfocado,
                ]}
              >
                <Text style={styles.marcadorTexto}>{parada.orden}</Text>
              </View>
            </Marker>
          );
        })}
      </Map>
    </View>
  );
}

export function MapaRepartoModal({
  visible,
  origen,
  paradas,
  enfoquePedidoId = null,
  onCerrar,
}: {
  visible: boolean;
  origen: PuntoGeografico | null;
  paradas: PlanificacionParada[];
  enfoquePedidoId?: string | null;
  onCerrar: () => void;
}) {
  const [enfoque, setEnfoque] = useState<string | null>(enfoquePedidoId);

  const paradaActual =
    paradas.find((parada) => parada.pedidoId === enfoque) ?? null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={styles.modalMapaPlan} edges={['top', 'bottom']}>
        <View style={styles.cabeceraMapaPlan}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>PEDIDOS · MAPA</Text>
            <Text style={styles.tituloMapaPlan}>
              {paradaActual
                ? `Parada ${paradaActual.orden} · ${paradaActual.clienteNombre}`
                : `Recorrido · ${paradas.length} parada(s)`}
            </Text>
          </View>
          <Pressable onPress={onCerrar} style={styles.secundarioCompacto}>
            <Text style={styles.secundarioTexto}>Cerrar</Text>
          </Pressable>
        </View>

        {paradas.length > 1 ? (
          <View style={styles.barraParadas}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.barraParadasContenido}
            >
              <Pressable
                onPress={() => setEnfoque(null)}
                style={[styles.chipMapa, enfoque === null && styles.chipMapaActivo]}
              >
                <Text
                  style={[
                    styles.chipMapaTexto,
                    enfoque === null && styles.chipMapaTextoActivo,
                  ]}
                >
                  Ruta completa
                </Text>
              </Pressable>
              {paradas.map((parada) => {
                const activa = enfoque === parada.pedidoId;
                return (
                  <Pressable
                    key={parada.pedidoId}
                    onPress={() => setEnfoque(parada.pedidoId)}
                    style={[styles.chipMapa, activa && styles.chipMapaActivo]}
                  >
                    <Text
                      style={[
                        styles.chipMapaTexto,
                        activa && styles.chipMapaTextoActivo,
                      ]}
                    >
                      {parada.orden}. {parada.clienteNombre}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.mapaPlanCuerpo}>
          <MapaReparto
            key={enfoque ?? 'ruta-completa'}
            origen={origen}
            paradas={paradas}
            enfoquePedidoId={enfoque}
            onEnfocarPedido={setEnfoque}
            interactivo
            expandido
          />
        </View>
        <View style={styles.mapaPlanAyuda}>
          <Text style={styles.ayuda}>
            {paradaActual
              ? 'Vista enfocada en este pedido. Toca “Ruta completa” para volver al recorrido.'
              : 'Todos los números corresponden al orden de entrega. Los marcadores usan una separación visual mínima para que dos pedidos cercanos no se oculten.'}
          </Text>
          <Text style={styles.ayuda}>
            La línea representa la secuencia geográfica sugerida, no navegación vial giro a giro.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
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
  sugerenciasEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  sugerencias: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddddd5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  sugerenciasTitulo: {
    color: '#717169',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 11,
    paddingTop: 9,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sugerencia: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#eeeeea',
  },
  sugerenciaPrincipal: {
    color: '#262622',
    fontSize: 13,
    fontWeight: '700',
  },
  sugerenciaSecundaria: {
    color: '#717169',
    fontSize: 11,
    marginTop: 2,
  },
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
  mapaCargando: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(246,245,240,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
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
  deshabilitado: { opacity: 0.5 },
  mapaPlan: {
    height: 250,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddddd5',
  },
  mapaPlanExpandido: {
    flex: 1,
    height: undefined,
    borderRadius: 0,
    borderWidth: 0,
  },
  modalMapaPlan: {
    flex: 1,
    backgroundColor: '#f6f5f0',
  },
  cabeceraMapaPlan: {
    backgroundColor: '#20201e',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tituloMapaPlan: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 3,
  },
  barraParadas: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddddd5',
  },
  barraParadasContenido: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 7,
  },
  chipMapa: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    borderRadius: 99,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  chipMapaActivo: {
    borderColor: '#b83b17',
    backgroundColor: '#fdf0e9',
  },
  chipMapaTexto: {
    color: '#66665e',
    fontSize: 11,
    fontWeight: '800',
  },
  chipMapaTextoActivo: { color: '#9b3215' },
  mapaPlanCuerpo: {
    flex: 1,
    backgroundColor: '#ecebe5',
  },
  mapaPlanAyuda: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddddd5',
  },
  marcador: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 7,
    borderRadius: 15,
    backgroundColor: '#b83b17',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcadorOrigen: { backgroundColor: '#20201e' },
  marcadorEnfocado: {
    backgroundColor: '#286344',
    borderColor: '#fff',
    transform: [{ scale: 1.14 }],
  },
  marcadorTexto: { color: '#fff', fontSize: 11, fontWeight: '900' },
});

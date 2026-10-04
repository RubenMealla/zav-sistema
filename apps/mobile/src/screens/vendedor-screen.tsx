import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ApiError,
  actualizarCliente,
  crearCliente,
  crearPedido,
  entregarPedidoConComprobacion,
  listarClientes,
  listarPedidos,
  obtenerDisponibilidad,
  planificarReparto,
  retirarPedido,
  retirarPedidosSeleccionados,
} from '@/lib/api';
import type {
  Cliente,
  Disponibilidad,
  PedidoResumen,
  PlanificacionParada,
  PlanificacionReparto,
  PuntoGeografico,
  Sesion,
} from '@/lib/tipos';
import { uuidV4 } from '@/lib/uuid';
import { MapaReparto, SelectorUbicacionMapa } from '@/components/mapas-distribucion';

type Seccion = 'pedidos' | 'nuevo' | 'clientes';

type Props = {
  sesion: Sesion;
  onCerrarSesion: () => Promise<void>;
};

function mensajeError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return 'Ocurrió un error inesperado.';
}

function estadoLegible(estado: PedidoResumen['estado']) {
  if (estado === 'REGISTRADO') return 'Registrado';
  if (estado === 'EN_DISTRIBUCION') return 'En distribución';
  return 'Entregado';
}

function fechaCorta(valor: string) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function distanciaMetros(a: PuntoGeografico, b: PuntoGeografico) {
  const radio = 6371008.8;
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLon = rad(b.longitud - a.longitud);
  const lat1 = rad(a.latitud);
  const lat2 = rad(b.latitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radio * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatearDistancia(metros: number) {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1)} km`;
}

function recalcularSecuencia(
  origen: PuntoGeografico,
  paradas: PlanificacionParada[],
) {
  let anterior = origen;
  let total = 0;
  const recalculadas = paradas.map((parada, indice) => {
    const distancia = distanciaMetros(anterior, parada);
    total += distancia;
    anterior = parada;
    return {
      ...parada,
      orden: indice + 1,
      distanciaDesdeAnteriorMetros: Math.round(distancia),
    };
  });
  return { paradas: recalculadas, total: Math.round(total) };
}

export function VendedorScreen({ sesion, onCerrarSesion }: Props) {
  const [seccion, setSeccion] = useState<Seccion>('pedidos');
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');

  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [clienteUbicacion, setClienteUbicacion] = useState<PuntoGeografico | null>(null);
  const [selectorUbicacionVisible, setSelectorUbicacionVisible] = useState(false);
  const [mapaParaEdicion, setMapaParaEdicion] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [clienteEditNombre, setClienteEditNombre] = useState('');
  const [clienteEditTelefono, setClienteEditTelefono] = useState('');
  const [clienteEditDireccion, setClienteEditDireccion] = useState('');
  const [clienteEditUbicacion, setClienteEditUbicacion] = useState<PuntoGeografico | null>(null);
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  const [clienteSeleccionado, setClienteSeleccionado] = useState('');
  const [observacion, setObservacion] = useState('');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [accionPedido, setAccionPedido] = useState<string | null>(null);
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState<string[]>([]);
  const [planificacion, setPlanificacion] = useState<PlanificacionReparto | null>(null);
  const [planificando, setPlanificando] = useState(false);
  const [retirandoSeleccionados, setRetirandoSeleccionados] = useState(false);

  const token = sesion.accessToken;

  const manejarError = useCallback(
    async (e: unknown) => {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        Alert.alert('Sesión no válida', 'Vuelve a iniciar sesión para continuar.');
        await onCerrarSesion();
        return;
      }
      setError(mensajeError(e));
    },
    [onCerrarSesion],
  );

  const consultarDatos = useCallback(
    () =>
      Promise.all([
        listarPedidos(token),
        listarClientes(token),
        obtenerDisponibilidad(token),
      ]),
    [token],
  );

  const cargar = useCallback(
    async (mostrarCarga = true) => {
      if (mostrarCarga) setCargando(true);
      setError('');
      try {
        const [p, c, d] = await consultarDatos();
        setPedidos(p.items);
        setClientes(c.items);
        setDisponibilidad(d);
      } catch (e) {
        await manejarError(e);
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    [consultarDatos, manejarError],
  );

  useEffect(() => {
    let activa = true;

    async function inicializar() {
      try {
        const [p, c, d] = await consultarDatos();
        if (!activa) return;
        setPedidos(p.items);
        setClientes(c.items);
        setDisponibilidad(d);
      } catch (e) {
        if (activa) await manejarError(e);
      } finally {
        if (activa) setCargando(false);
      }
    }

    void inicializar();
    return () => {
      activa = false;
    };
  }, [consultarDatos, manejarError]);

  async function refrescar() {
    setActualizando(true);
    await cargar(false);
  }

  async function guardarCliente() {
    if (!clienteNombre.trim()) {
      setError('El nombre del cliente es obligatorio.');
      return;
    }
    if (!clienteUbicacion || !clienteDireccion.trim()) {
      setError('Define y confirma la ubicación del cliente en el mapa.');
      return;
    }

    setGuardandoCliente(true);
    setError('');
    try {
      const cliente = await crearCliente(token, {
        nombre: clienteNombre.trim(),
        telefono: clienteTelefono.trim() || undefined,
        direccion: clienteDireccion.trim(),
        latitud: clienteUbicacion.latitud,
        longitud: clienteUbicacion.longitud,
      });
      setClientes((actuales) =>
        [...actuales, cliente].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      setClienteNombre('');
      setClienteTelefono('');
      setClienteDireccion('');
      setClienteUbicacion(null);
      Alert.alert(
        'Cliente registrado',
        'El cliente y su punto de entrega quedaron disponibles para pedidos.',
      );
    } catch (e) {
      await manejarError(e);
    } finally {
      setGuardandoCliente(false);
    }
  }

  function abrirMapaNuevoCliente() {
    setMapaParaEdicion(false);
    setSelectorUbicacionVisible(true);
  }

  function iniciarEdicionCliente(cliente: Cliente) {
    setClienteEditando(cliente);
    setClienteEditNombre(cliente.nombre);
    setClienteEditTelefono(cliente.telefono ?? '');
    setClienteEditDireccion(cliente.direccion);
    setClienteEditUbicacion(
      cliente.ubicacion
        ? {
            latitud: cliente.ubicacion.latitud,
            longitud: cliente.ubicacion.longitud,
          }
        : null,
    );
    setError('');
  }

  function cancelarEdicionCliente() {
    setClienteEditando(null);
    setClienteEditNombre('');
    setClienteEditTelefono('');
    setClienteEditDireccion('');
    setClienteEditUbicacion(null);
    setMapaParaEdicion(false);
  }

  function abrirMapaEdicionCliente() {
    if (!clienteEditando) return;
    setMapaParaEdicion(true);
    setSelectorUbicacionVisible(true);
  }

  async function guardarEdicionCliente() {
    if (!clienteEditando) return;
    if (!clienteEditNombre.trim()) {
      setError('El nombre del cliente es obligatorio.');
      return;
    }
    if (!clienteEditUbicacion || !clienteEditDireccion.trim()) {
      setError('El cliente debe tener una ubicación confirmada en Tarija.');
      return;
    }

    setGuardandoCliente(true);
    setError('');
    try {
      const actualizado = await actualizarCliente(token, clienteEditando.id, {
        nombre: clienteEditNombre.trim(),
        telefono: clienteEditTelefono.trim() || undefined,
        direccion: clienteEditDireccion.trim(),
        latitud: clienteEditUbicacion.latitud,
        longitud: clienteEditUbicacion.longitud,
      });
      setClientes((actuales) =>
        actuales
          .map((cliente) => (cliente.id === actualizado.id ? actualizado : cliente))
          .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      cancelarEdicionCliente();
      Alert.alert(
        'Cliente actualizado',
        'Los pedidos nuevos usarán estos datos. Los pedidos ya registrados conservan su destino histórico.',
      );
    } catch (e) {
      await manejarError(e);
    } finally {
      setGuardandoCliente(false);
    }
  }

  async function confirmarUbicacionMapa(
    valor: PuntoGeografico & { direccion: string },
  ) {
    const ubicacion = {
      latitud: valor.latitud,
      longitud: valor.longitud,
    };

    if (mapaParaEdicion && clienteEditando) {
      setClienteEditDireccion(valor.direccion);
      setClienteEditUbicacion(ubicacion);
    } else {
      setClienteDireccion(valor.direccion);
      setClienteUbicacion(ubicacion);
    }

    setSelectorUbicacionVisible(false);
    setMapaParaEdicion(false);
    setError('');
  }

  async function guardarPedido() {
    if (!clienteSeleccionado) {
      setError('Selecciona un cliente.');
      return;
    }

    const clienteActual = clientes.find((cliente) => cliente.id === clienteSeleccionado);
    if (!clienteActual?.ubicacion) {
      setError('El cliente seleccionado debe tener una ubicación confirmada antes de registrar el pedido.');
      return;
    }

    const detalles = disponibilidad
      .map((producto) => ({
        productoId: producto.productoId,
        cantidad: Number(cantidades[producto.productoId] ?? '0'),
      }))
      .filter((detalle) => Number.isInteger(detalle.cantidad) && detalle.cantidad > 0);

    if (!detalles.length) {
      setError('Indica al menos una cantidad de producto.');
      return;
    }

    const invalido = detalles.find((detalle) => {
      const producto = disponibilidad.find((p) => p.productoId === detalle.productoId);
      return !producto || detalle.cantidad > producto.cantidadDisponible;
    });
    if (invalido) {
      setError('Una de las cantidades supera la disponibilidad mostrada.');
      return;
    }

    setGuardandoPedido(true);
    setError('');
    try {
      await crearPedido(token, {
        clienteId: clienteSeleccionado,
        observacion: observacion.trim() || undefined,
        detalles,
      });
      setClienteSeleccionado('');
      setObservacion('');
      setCantidades({});
      await cargar(false);
      setSeccion('pedidos');
      Alert.alert('Pedido registrado', 'El stock disponible quedó comprometido para el pedido.');
    } catch (e) {
      await manejarError(e);
    } finally {
      setGuardandoPedido(false);
    }
  }

  async function retirar(pedido: PedidoResumen) {
    Alert.alert(
      'Retirar para reparto',
      `¿Confirmas que ya recibiste físicamente los productos del pedido de ${pedido.cliente.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Retirar para reparto',
          onPress: () => {
            void ejecutarRetiro(pedido.id);
          },
        },
      ],
    );
  }

  async function ejecutarRetiro(id: string) {
    setAccionPedido(id);
    setError('');
    try {
      await retirarPedido(token, id, uuidV4());
      await cargar(false);
      Alert.alert('Productos en reparto', 'El pedido pasó a En distribución bajo tu custodia.');
    } catch (e) {
      await manejarError(e);
    } finally {
      setAccionPedido(null);
    }
  }

  async function abrirNavegacion(pedido: PedidoResumen) {
    if (!pedido.destinoGps) {
      setError('Este pedido no tiene un destino georreferenciado.');
      return;
    }
    const destino = `${pedido.destinoGps.latitud},${pedido.destinoGps.longitud}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
    const disponible = await Linking.canOpenURL(url);
    if (!disponible) {
      setError('No se pudo abrir la aplicación de mapas.');
      return;
    }
    await Linking.openURL(url);
  }

  async function entregar(pedido: PedidoResumen) {
    setAccionPedido(pedido.id);
    setError('');
    try {
      const servicios = await Location.hasServicesEnabledAsync();
      if (!servicios) {
        Alert.alert(
          'Ubicación desactivada',
          'Activa la ubicación del teléfono y vuelve a intentar la entrega.',
        );
        return;
      }

      const permiso = await Location.requestForegroundPermissionsAsync();
      if (permiso.status !== 'granted') {
        Alert.alert(
          'Permiso requerido',
          'La entrega no se registró porque no se autorizó la ubicación puntual.',
        );
        return;
      }

      const posicion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const distancia = pedido.destinoGps
        ? distanciaMetros(
            pedido.destinoGps,
            {
              latitud: posicion.coords.latitude,
              longitud: posicion.coords.longitude,
            },
          )
        : null;
      const precision = posicion.coords.accuracy;

      const detalleDistancia =
        distancia === null
          ? 'Este pedido no tiene destino georreferenciado para comparar.'
          : `Estás aproximadamente a ${formatearDistancia(distancia)} del punto de entrega registrado.`;
      const detallePrecision =
        typeof precision === 'number'
          ? ` Precisión reportada: ±${Math.round(precision)} m.`
          : '';

      Alert.alert(
        'Comprobar entrega',
        `${detalleDistancia}${detallePrecision}\n\nLa ubicación se capturó solo para esta confirmación. ¿Registrar la entrega?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Confirmar entrega',
            onPress: () => {
              void confirmarEntregaCapturada(
                pedido.id,
                posicion.coords.latitude,
                posicion.coords.longitude,
                typeof precision === 'number' ? precision : undefined,
              );
            },
          },
        ],
      );
    } catch (e) {
      await manejarError(e);
    } finally {
      setAccionPedido(null);
    }
  }

  async function confirmarEntregaCapturada(
    id: string,
    latitud: number,
    longitud: number,
    precisionMetros?: number,
  ) {
    setAccionPedido(id);
    setError('');
    try {
      const entrega = await entregarPedidoConComprobacion(token, id, {
        operacionClave: uuidV4(),
        latitud,
        longitud,
        precisionMetros,
      });
      await cargar(false);

      const distancia = entrega.entregaGps?.distanciaDestinoMetros;
      Alert.alert(
        'Entrega registrada',
        distancia === null || distancia === undefined
          ? 'La entrega y su ubicación puntual fueron registradas.'
          : `Entrega registrada. Distancia al destino esperado: ${formatearDistancia(distancia)}.`,
      );
    } catch (e) {
      await manejarError(e);
    } finally {
      setAccionPedido(null);
    }
  }

  function alternarPedidoPlanificacion(id: string) {
    setPlanificacion(null);
    setPedidosSeleccionados((actuales) =>
      actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id],
    );
  }

  async function generarPlanificacion(origen: 'DESPACHO' | 'ACTUAL') {
    if (pedidosSeleccionados.length < 2) {
      setError('Selecciona al menos dos pedidos georreferenciados para planificar.');
      return;
    }

    setPlanificando(true);
    setError('');
    try {
      if (origen === 'DESPACHO') {
        setPlanificacion(
          await planificarReparto(token, {
            pedidoIds: pedidosSeleccionados,
            origenTipo: 'DESPACHO',
          }),
        );
        return;
      }

      const permiso = await Location.requestForegroundPermissionsAsync();
      if (permiso.status !== 'granted') {
        setError('Se necesita permiso de ubicación para usar tu posición como origen.');
        return;
      }
      const posicion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setPlanificacion(
        await planificarReparto(token, {
          pedidoIds: pedidosSeleccionados,
          origenTipo: 'ACTUAL',
          origenLatitud: posicion.coords.latitude,
          origenLongitud: posicion.coords.longitude,
        }),
      );
    } catch (e) {
      await manejarError(e);
    } finally {
      setPlanificando(false);
    }
  }

  async function ejecutarRetiroSeleccionados() {
    const registrados = pedidos.filter(
      (pedido) =>
        pedidosSeleccionados.includes(pedido.id) &&
        pedido.estado === 'REGISTRADO',
    );

    if (!registrados.length) {
      setError('Los pedidos seleccionados ya están en distribución o fueron entregados.');
      return;
    }

    setRetirandoSeleccionados(true);
    setError('');
    try {
      const resultado = await retirarPedidosSeleccionados(
        token,
        registrados.map((pedido) => ({
          pedidoId: pedido.id,
          operacionClave: uuidV4(),
        })),
      );

      await cargar(false);
      setPlanificacion(null);
      setPedidosSeleccionados([]);

      const detalle =
        resultado.fallidos === 0
          ? `${resultado.exitosos} pedido(s) pasaron a reparto.`
          : `${resultado.exitosos} retiro(s) correctos y ${resultado.fallidos} con observaciones.`;

      Alert.alert('Retiro para reparto', detalle);
    } catch (e) {
      await manejarError(e);
    } finally {
      setRetirandoSeleccionados(false);
    }
  }

  function confirmarRetiroSeleccionados() {
    const cantidad = pedidos.filter(
      (pedido) =>
        pedidosSeleccionados.includes(pedido.id) &&
        pedido.estado === 'REGISTRADO',
    ).length;

    if (!cantidad) {
      setError('Selecciona al menos un pedido registrado.');
      return;
    }

    Alert.alert(
      'Retirar seleccionados para reparto',
      `Confirma que ya recibiste físicamente los productos de ${cantidad} pedido(s).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar retiro',
          onPress: () => {
            void ejecutarRetiroSeleccionados();
          },
        },
      ],
    );
  }

  function moverParada(indice: number, direccion: -1 | 1) {
    setPlanificacion((actual) => {
      if (!actual) return actual;
      const destino = indice + direccion;
      if (destino < 0 || destino >= actual.paradas.length) return actual;
      const paradas = [...actual.paradas];
      [paradas[indice], paradas[destino]] = [paradas[destino], paradas[indice]];
      const recalculadas = recalcularSecuencia(actual.origen, paradas);
      return {
        ...actual,
        paradas: recalculadas.paradas,
        distanciaTotalAproximadaMetros: recalculadas.total,
      };
    });
  }

  const productosConStock = useMemo(
    () => disponibilidad.filter((item) => item.cantidadDisponible > 0),
    [disponibilidad],
  );

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#b83b17" />
        <Text style={styles.textoSecundario}>Cargando información del Vendedor…</Text>
      </View>
    );
  }

  return (
    <View style={styles.pantalla}>
      <View style={styles.encabezado}>
        <View style={styles.encabezadoTexto}>
          <Text style={styles.eyebrow}>ZAV · VENDEDOR</Text>
          <Text style={styles.nombre}>{sesion.usuario.nombre}</Text>
        </View>
        <Pressable onPress={() => void onCerrarSesion()} style={styles.botonSecundarioCompacto}>
          <Text style={styles.botonSecundarioTexto}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Tab
          activo={seccion === 'pedidos'}
          texto="Pedidos"
          onPress={() => setSeccion('pedidos')}
        />
        <Tab
          activo={seccion === 'nuevo'}
          texto="Nuevo pedido"
          onPress={() => setSeccion('nuevo')}
        />
        <Tab
          activo={seccion === 'clientes'}
          texto="Clientes"
          onPress={() => setSeccion('clientes')}
        />
      </View>

      {error ? (
        <View style={styles.alerta}>
          <Text style={styles.alertaTexto}>{error}</Text>
          <Pressable onPress={() => setError('')}>
            <Text style={styles.alertaCerrar}>Cerrar</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={actualizando} onRefresh={() => void refrescar()} />
        }
      >
        {seccion === 'pedidos' ? (
          <>
            <Pedidos
              pedidos={pedidos}
              accionPedido={accionPedido}
              onRetirar={retirar}
              onEntregar={entregar}
              onNavegar={(pedido) => void abrirNavegacion(pedido)}
            />
            <Reparto
              pedidos={pedidos}
              seleccionados={pedidosSeleccionados}
              planificacion={planificacion}
              planificando={planificando}
              retirando={retirandoSeleccionados}
              onAlternar={alternarPedidoPlanificacion}
              onPlanificarDespacho={() => void generarPlanificacion('DESPACHO')}
              onPlanificarActual={() => void generarPlanificacion('ACTUAL')}
              onRetirarSeleccionados={confirmarRetiroSeleccionados}
              onMover={moverParada}
            />
          </>
        ) : null}

        {seccion === 'clientes' ? (
          <Clientes
            clientes={clientes}
            nombre={clienteNombre}
            telefono={clienteTelefono}
            direccion={clienteDireccion}
            ubicacion={clienteUbicacion}
            guardando={guardandoCliente}
            setNombre={setClienteNombre}
            setTelefono={setClienteTelefono}
            onAbrirMapa={abrirMapaNuevoCliente}
            onGuardar={guardarCliente}
            clienteEditando={clienteEditando}
            editNombre={clienteEditNombre}
            editTelefono={clienteEditTelefono}
            editDireccion={clienteEditDireccion}
            editUbicacion={clienteEditUbicacion}
            setEditNombre={setClienteEditNombre}
            setEditTelefono={setClienteEditTelefono}
            onEditar={iniciarEdicionCliente}
            onCancelarEdicion={cancelarEdicionCliente}
            onAbrirMapaEdicion={abrirMapaEdicionCliente}
            onGuardarEdicion={() => void guardarEdicionCliente()}
          />
        ) : null}

        {seccion === 'nuevo' ? (
          <NuevoPedido
            clientes={clientes}
            productos={productosConStock}
            clienteSeleccionado={clienteSeleccionado}
            observacion={observacion}
            cantidades={cantidades}
            guardando={guardandoPedido}
            setClienteSeleccionado={setClienteSeleccionado}
            setObservacion={setObservacion}
            setCantidades={setCantidades}
            onGuardar={guardarPedido}
          />
        ) : null}
      </ScrollView>

      {selectorUbicacionVisible ? (
        <SelectorUbicacionMapa
          visible
          token={token}
          direccionInicial={mapaParaEdicion ? clienteEditDireccion : clienteDireccion}
          puntoInicial={mapaParaEdicion ? clienteEditUbicacion : clienteUbicacion}
          onCancelar={() => {
            setSelectorUbicacionVisible(false);
            setMapaParaEdicion(false);
          }}
          onConfirmar={(valor) => void confirmarUbicacionMapa(valor)}
        />
      ) : null}
    </View>
  );
}

function Tab({
  activo,
  texto,
  onPress,
}: {
  activo: boolean;
  texto: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: activo }}
      onPress={onPress}
      style={[styles.tab, activo && styles.tabActivo]}
    >
      <Text style={[styles.tabTexto, activo && styles.tabTextoActivo]}>{texto}</Text>
    </Pressable>
  );
}

function Pedidos({
  pedidos,
  accionPedido,
  onRetirar,
  onEntregar,
  onNavegar,
}: {
  pedidos: PedidoResumen[];
  accionPedido: string | null;
  onRetirar: (pedido: PedidoResumen) => void;
  onEntregar: (pedido: PedidoResumen) => void;
  onNavegar: (pedido: PedidoResumen) => void;
}) {
  return (
    <View style={styles.bloque}>
      <Titulo
        titulo="Mis pedidos"
        descripcion="Desliza hacia abajo para actualizar el estado y la disponibilidad."
      />

      {!pedidos.length ? (
        <Vacio texto="Todavía no registraste pedidos." />
      ) : (
        pedidos.map((pedido) => (
          <View key={pedido.id} style={styles.tarjeta}>
            <View style={styles.filaEntre}>
              <View style={styles.flex}>
                <Text style={styles.tarjetaTitulo}>{pedido.cliente.nombre}</Text>
                <Text style={styles.textoSecundario}>{fechaCorta(pedido.creadoEn)}</Text>
              </View>
              <Estado estado={pedido.estado} />
            </View>

            <Text style={styles.direccion}>{pedido.direccionEntrega}</Text>

            <View style={styles.resumenPedido}>
              <Dato etiqueta="Unidades" valor={String(pedido.unidades)} />
              <Dato etiqueta="Total" valor={`Bs ${pedido.totalBob}`} />
            </View>

            {pedido.estado === 'REGISTRADO' ? (
              <BotonAccion
                texto="Retirar para reparto"
                cargando={accionPedido === pedido.id}
                onPress={() => onRetirar(pedido)}
              />
            ) : null}

            {pedido.estado === 'EN_DISTRIBUCION' ? (
              <View style={styles.accionesPedido}>
                {pedido.destinoGps ? (
                  <Pressable onPress={() => onNavegar(pedido)} style={styles.botonMapa}>
                    <Text style={styles.botonMapaTexto}>Abrir navegación</Text>
                  </Pressable>
                ) : null}
                <BotonAccion
                  texto="Comprobar y confirmar entrega"
                  cargando={accionPedido === pedido.id}
                  onPress={() => onEntregar(pedido)}
                />
              </View>
            ) : null}

            {pedido.estado === 'ENTREGADO' && pedido.entregadoEn ? (
              <Text style={styles.confirmado}>
                Entregado · {fechaCorta(pedido.entregadoEn)}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

function Clientes({
  clientes,
  nombre,
  telefono,
  direccion,
  ubicacion,
  guardando,
  setNombre,
  setTelefono,
  setDireccion,
  onAbrirMapa,
  onEditarUbicacion,
  onGuardar,
}: {
  clientes: Cliente[];
  nombre: string;
  telefono: string;
  direccion: string;
  ubicacion: PuntoGeografico | null;
  guardando: boolean;
  setNombre: (v: string) => void;
  setTelefono: (v: string) => void;
  setDireccion: (v: string) => void;
  onAbrirMapa: () => void;
  onEditarUbicacion: (cliente: Cliente) => void;
  onGuardar: () => void;
}) {
  return (
    <View style={styles.bloque}>
      <Titulo
        titulo="Clientes"
        descripcion="Registra únicamente los datos necesarios para preparar y entregar pedidos."
      />

      <View style={styles.tarjeta}>
        <Text style={styles.seccionTitulo}>Nuevo cliente</Text>
        <Campo label="Nombre" value={nombre} onChangeText={setNombre} />
        <Campo
          label="Teléfono (opcional)"
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
        />
        <Campo
          label="Dirección"
          value={direccion}
          onChangeText={setDireccion}
          multiline
        />
        <Pressable onPress={onAbrirMapa} style={styles.botonMapa}>
          <Text style={styles.botonMapaTexto}>
            {ubicacion ? 'Revisar ubicación en mapa' : 'Definir ubicación en mapa'}
          </Text>
        </Pressable>
        {ubicacion ? (
          <Text style={styles.confirmado}>
            Punto confirmado · {ubicacion.latitud.toFixed(6)}, {ubicacion.longitud.toFixed(6)}
          </Text>
        ) : (
          <Text style={styles.textoSecundario}>
            La ubicación no se guarda automáticamente. Debes confirmarla en el mapa.
          </Text>
        )}
        <BotonAccion
          texto="Guardar cliente"
          cargando={guardando}
          onPress={onGuardar}
        />
      </View>

      <Text style={styles.contador}>{clientes.length} cliente(s) activo(s)</Text>
      {clientes.map((cliente) => (
        <View key={cliente.id} style={styles.tarjetaCompacta}>
          <Text style={styles.tarjetaTitulo}>{cliente.nombre}</Text>
          <Text style={styles.direccion}>{cliente.direccion}</Text>
          {cliente.telefono ? (
            <Text style={styles.textoSecundario}>{cliente.telefono}</Text>
          ) : null}
          <Text style={cliente.ubicacion ? styles.disponible : styles.textoSecundario}>
            {cliente.ubicacion ? 'Ubicación de entrega confirmada' : 'Sin ubicación georreferenciada'}
          </Text>
          <Pressable
            onPress={() => onEditarUbicacion(cliente)}
            style={styles.botonMapaCompacto}
          >
            <Text style={styles.botonMapaTexto}>
              {cliente.ubicacion ? 'Corregir ubicación' : 'Definir ubicación'}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function Reparto({
  pedidos,
  seleccionados,
  planificacion,
  planificando,
  retirando,
  onAlternar,
  onPlanificarDespacho,
  onPlanificarActual,
  onRetirarSeleccionados,
  onMover,
}: {
  pedidos: PedidoResumen[];
  seleccionados: string[];
  planificacion: PlanificacionReparto | null;
  planificando: boolean;
  retirando: boolean;
  onAlternar: (id: string) => void;
  onPlanificarDespacho: () => void;
  onPlanificarActual: () => void;
  onRetirarSeleccionados: () => void;
  onMover: (indice: number, direccion: -1 | 1) => void;
}) {
  const disponibles = pedidos.filter(
    (pedido) =>
      pedido.estado !== 'ENTREGADO' &&
      pedido.destinoGps !== null,
  );

  // Con un solo pedido no hace falta un planificador separado: las acciones
  // de retiro, navegación y entrega permanecen directamente en su tarjeta.
  if (disponibles.length < 2) return null;

  return (
    <View style={styles.bloque}>
      <View style={styles.separadorReparto} />
      <Titulo
        titulo="Organizar reparto"
        descripcion="Cuando tienes dos o más pedidos con ubicación confirmada, puedes sugerir un orden de visita y ajustarlo manualmente."
      />

      {!disponibles.length ? (
        <Vacio texto="No hay pedidos pendientes con destino georreferenciado." />
      ) : (
        disponibles.map((pedido) => {
          const activo = seleccionados.includes(pedido.id);
          return (
            <Pressable
              key={pedido.id}
              onPress={() => onAlternar(pedido.id)}
              style={[styles.opcion, activo && styles.opcionActiva]}
            >
              <View style={styles.filaEntre}>
                <View style={styles.flex}>
                  <Text style={[styles.opcionTitulo, activo && styles.opcionTituloActiva]}>
                    {pedido.cliente.nombre}
                  </Text>
                  <Text style={styles.opcionSubtitulo}>{pedido.direccionEntrega}</Text>
                </View>
                <Text style={styles.seleccionMarca}>{activo ? '✓' : '+'}</Text>
              </View>
            </Pressable>
          );
        })
      )}

      <Text style={styles.textoSecundario}>
        Seleccionados: {seleccionados.length}. Se requieren al menos 2.
      </Text>

      <View style={styles.fila}>
        <Pressable
          disabled={planificando}
          onPress={onPlanificarDespacho}
          style={styles.botonMapa}
        >
          <Text style={styles.botonMapaTexto}>Desde ZAV</Text>
        </Pressable>
        <Pressable
          disabled={planificando}
          onPress={onPlanificarActual}
          style={styles.botonMapa}
        >
          <Text style={styles.botonMapaTexto}>Desde mi ubicación</Text>
        </Pressable>
      </View>

      {planificando ? <ActivityIndicator color="#b83b17" /> : null}

      {planificacion ? (
        <>
          <View style={styles.tarjeta}>
            <Text style={styles.seccionTitulo}>Secuencia geográfica sugerida</Text>
            <Text style={styles.textoSecundario}>
              Distancia geodésica aproximada total: {formatearDistancia(planificacion.distanciaTotalAproximadaMetros)}
            </Text>
            <Text style={styles.textoSecundario}>{planificacion.limitacion}</Text>
          </View>

          <MapaReparto origen={planificacion.origen} paradas={planificacion.paradas} />

          {planificacion.paradas.map((parada, indice) => (
            <View key={parada.pedidoId} style={styles.tarjetaCompacta}>
              <View style={styles.filaEntre}>
                <View style={styles.flex}>
                  <Text style={styles.tarjetaTitulo}>
                    {parada.orden}. {parada.clienteNombre}
                  </Text>
                  <Text style={styles.direccion}>{parada.direccionEntrega}</Text>
                  <Text style={styles.textoSecundario}>
                    Desde la parada anterior: {formatearDistancia(parada.distanciaDesdeAnteriorMetros)}
                  </Text>
                </View>
                <View style={styles.reordenar}>
                  <Pressable
                    disabled={indice === 0}
                    onPress={() => onMover(indice, -1)}
                    style={styles.botonOrden}
                  >
                    <Text style={styles.botonOrdenTexto}>↑</Text>
                  </Pressable>
                  <Pressable
                    disabled={indice === planificacion.paradas.length - 1}
                    onPress={() => onMover(indice, 1)}
                    style={styles.botonOrden}
                  >
                    <Text style={styles.botonOrdenTexto}>↓</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

function NuevoPedido({
  clientes,
  productos,
  clienteSeleccionado,
  observacion,
  cantidades,
  guardando,
  setClienteSeleccionado,
  setObservacion,
  setCantidades,
  onGuardar,
}: {
  clientes: Cliente[];
  productos: Disponibilidad[];
  clienteSeleccionado: string;
  observacion: string;
  cantidades: Record<string, string>;
  guardando: boolean;
  setClienteSeleccionado: (v: string) => void;
  setObservacion: (v: string) => void;
  setCantidades: (v: Record<string, string>) => void;
  onGuardar: () => void;
}) {
  return (
    <View style={styles.bloque}>
      <Titulo
        titulo="Nuevo pedido"
        descripcion="Selecciona un cliente y registra solo cantidades con disponibilidad actual."
      />

      <Text style={styles.seccionTitulo}>1. Cliente</Text>
      {!clientes.length ? (
        <Vacio texto="Primero registra un cliente en la sección Clientes." />
      ) : (
        <View style={styles.selectorLista}>
          {clientes.map((cliente) => {
            const activo = clienteSeleccionado === cliente.id;
            return (
              <Pressable
                key={cliente.id}
                onPress={() => setClienteSeleccionado(cliente.id)}
                style={[styles.opcion, activo && styles.opcionActiva]}
              >
                <Text style={[styles.opcionTitulo, activo && styles.opcionTituloActiva]}>
                  {cliente.nombre}
                </Text>
                <Text style={styles.opcionSubtitulo}>{cliente.direccion}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.seccionTitulo}>2. Productos</Text>
      {!productos.length ? (
        <Vacio texto="No hay productos disponibles en Venta y Despacho." />
      ) : (
        productos.map((producto) => (
          <View key={producto.productoId} style={styles.producto}>
            <View style={styles.flex}>
              <Text style={styles.tarjetaTitulo}>{producto.nombre}</Text>
              <Text style={styles.textoSecundario}>
                {producto.presentacion} · Bs {producto.precioBob}
              </Text>
              <Text style={styles.disponible}>
                Disponible: {producto.cantidadDisponible}
              </Text>
            </View>
            <TextInput
              accessibilityLabel={`Cantidad de ${producto.nombre}`}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#8a8982"
              style={styles.cantidad}
              value={cantidades[producto.productoId] ?? ''}
              onChangeText={(valor) =>
                setCantidades({ ...cantidades, [producto.productoId]: valor.replace(/\D/g, '') })
              }
            />
          </View>
        ))
      )}

      <Text style={styles.seccionTitulo}>3. Observación</Text>
      <Campo
        label="Opcional"
        value={observacion}
        onChangeText={setObservacion}
        multiline
      />

      <BotonAccion
        texto="Registrar pedido"
        cargando={guardando}
        onPress={onGuardar}
      />
    </View>
  );
}

function Titulo({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <View style={styles.tituloBloque}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.descripcion}>{descripcion}</Text>
    </View>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <View style={styles.vacio}>
      <Text style={styles.textoSecundario}>{texto}</Text>
    </View>
  );
}

function Campo({
  label,
  value,
  onChangeText,
  multiline = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad';
}) {
  return (
    <View style={styles.campo}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor="#8a8982"
      />
    </View>
  );
}

function BotonAccion({
  texto,
  cargando,
  onPress,
}: {
  texto: string;
  cargando: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={cargando}
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        pressed && styles.botonPresionado,
        cargando && styles.deshabilitado,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.botonTexto}>{texto}</Text>
      )}
    </Pressable>
  );
}

function Estado({ estado }: { estado: PedidoResumen['estado'] }) {
  return (
    <View
      style={[
        styles.estado,
        estado === 'REGISTRADO' && styles.estadoRegistrado,
        estado === 'EN_DISTRIBUCION' && styles.estadoDistribucion,
        estado === 'ENTREGADO' && styles.estadoEntregado,
      ]}
    >
      <Text style={styles.estadoTexto}>{estadoLegible(estado)}</Text>
    </View>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text style={styles.datoValor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#f6f5f0' },
  centrado: {
    flex: 1,
    backgroundColor: '#f6f5f0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  encabezado: {
    backgroundColor: '#20201e',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  encabezadoTexto: { flex: 1, gap: 3 },
  eyebrow: {
    color: '#f2a488',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  nombre: { color: '#fff', fontSize: 18, fontWeight: '800' },
  botonSecundarioCompacto: {
    borderWidth: 1,
    borderColor: '#66665e',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  botonSecundarioTexto: { color: '#fff', fontWeight: '700', fontSize: 12 },
  tabs: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddddd5',
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActivo: { borderBottomColor: '#b83b17' },
  tabTexto: { color: '#717169', fontSize: 12, fontWeight: '700' },
  tabTextoActivo: { color: '#b83b17' },
  contenido: { padding: 16, paddingBottom: 72 },
  bloque: { gap: 12 },
  separadorReparto: {
    height: 1,
    backgroundColor: '#ddddd5',
    marginTop: 12,
    marginBottom: 4,
  },
  tituloBloque: { gap: 5, marginBottom: 2 },
  titulo: { color: '#20201e', fontSize: 24, fontWeight: '800' },
  descripcion: { color: '#66665e', lineHeight: 20, fontSize: 13 },
  tarjeta: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddddd5',
    borderRadius: 9,
    padding: 15,
    gap: 12,
  },
  tarjetaCompacta: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddddd5',
    borderRadius: 8,
    padding: 14,
    gap: 5,
  },
  tarjetaTitulo: { color: '#262622', fontWeight: '800', fontSize: 15 },
  textoSecundario: { color: '#717169', fontSize: 12, lineHeight: 18 },
  direccion: { color: '#50504a', fontSize: 13, lineHeight: 19 },
  filaEntre: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flex: { flex: 1 },
  resumenPedido: { flexDirection: 'row', gap: 30 },
  datoEtiqueta: {
    color: '#717169',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  datoValor: { color: '#262622', fontSize: 15, fontWeight: '800', marginTop: 2 },
  estado: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  estadoRegistrado: { backgroundColor: '#fff5d9' },
  estadoDistribucion: { backgroundColor: '#edf4fa' },
  estadoEntregado: { backgroundColor: '#eaf4ed' },
  estadoTexto: { color: '#50504a', fontSize: 10, fontWeight: '800' },
  boton: {
    minHeight: 46,
    borderRadius: 7,
    backgroundColor: '#b83b17',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  botonPresionado: { backgroundColor: '#963011' },
  botonTexto: { color: '#fff', fontWeight: '800', fontSize: 14 },
  deshabilitado: { opacity: 0.55 },
  confirmado: {
    color: '#286344',
    backgroundColor: '#eaf4ed',
    padding: 10,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  seccionTitulo: {
    color: '#50504a',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 6,
  },
  campo: { gap: 5 },
  label: { color: '#66665e', fontSize: 12, fontWeight: '700' },
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
  inputMultiline: { minHeight: 78, paddingTop: 11, textAlignVertical: 'top' },
  contador: { color: '#717169', fontSize: 12, marginTop: 4 },
  selectorLista: { gap: 7 },
  opcion: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddddd5',
    borderRadius: 8,
    padding: 12,
    gap: 3,
  },
  opcionActiva: { borderColor: '#b83b17', backgroundColor: '#fdf0e9' },
  opcionTitulo: { color: '#262622', fontSize: 14, fontWeight: '700' },
  opcionTituloActiva: { color: '#b83b17' },
  opcionSubtitulo: { color: '#717169', fontSize: 11 },
  producto: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddddd5',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  disponible: { color: '#286344', fontSize: 11, fontWeight: '800', marginTop: 3 },
  cantidad: {
    width: 64,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    borderRadius: 7,
    textAlign: 'center',
    fontSize: 16,
    color: '#262622',
    backgroundColor: '#fff',
  },
  vacio: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#c6c5bd',
    borderRadius: 8,
    padding: 16,
  },
  alerta: {
    backgroundColor: '#fcefeb',
    borderBottomWidth: 1,
    borderBottomColor: '#e7c1bb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  alertaTexto: { color: '#a1322c', fontSize: 12, flex: 1, lineHeight: 18 },
  alertaCerrar: { color: '#a1322c', fontSize: 12, fontWeight: '800' },
  accionesPedido: { gap: 8 },
  botonMapa: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#b83b17',
    borderRadius: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    flex: 1,
  },
  botonMapaTexto: { color: '#b83b17', fontWeight: '800', fontSize: 12 },
  botonMapaCompacto: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#b83b17',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  fila: { flexDirection: 'row', gap: 8 },
  seleccionMarca: {
    color: '#b83b17',
    fontSize: 20,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
  },
  reordenar: { gap: 5 },
  botonOrden: {
    width: 36,
    height: 32,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  botonOrdenTexto: { color: '#50504a', fontSize: 18, fontWeight: '800' },
});

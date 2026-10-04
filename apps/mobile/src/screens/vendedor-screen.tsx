import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { MapaReparto, MapaRepartoModal, SelectorUbicacionMapa } from '@/components/mapas-distribucion';
import {
  SelectorClientePedidoModal,
  SelectorProductosPedidoModal,
} from '@/components/selectores-pedido';

type Seccion = 'pedidos' | 'nuevo' | 'clientes';

type Props = {
  sesion: Sesion;
  onCerrarSesion: () => Promise<void>;
};

type MapaOperativoVista = {
  origen: PuntoGeografico | null;
  paradas: PlanificacionParada[];
  enfoquePedidoId?: string | null;
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
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function claveFechaBolivia(valor: string | Date) {
  const fecha = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

function esHoyBolivia(valor: string) {
  return claveFechaBolivia(valor) === claveFechaBolivia(new Date());
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
  const [aviso, setAviso] = useState('');

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
  const [selectorClientePedidoVisible, setSelectorClientePedidoVisible] = useState(false);
  const [selectorProductosPedidoVisible, setSelectorProductosPedidoVisible] = useState(false);
  const [accionPedido, setAccionPedido] = useState<string | null>(null);
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState<string[]>([]);
  const [planificacion, setPlanificacion] = useState<PlanificacionReparto | null>(null);
  const [planificando, setPlanificando] = useState(false);
  const [retirandoSeleccionados, setRetirandoSeleccionados] = useState(false);
  const [mapaOperativo, setMapaOperativo] = useState<MapaOperativoVista | null>(null);
  const scrollPrincipalRef = useRef<ScrollView>(null);
  const accionesEnCursoRef = useRef(new Set<string>());

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
    requestAnimationFrame(() => {
      scrollPrincipalRef.current?.scrollTo({ y: 0, animated: true });
    });
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
      setAviso('Pedido registrado. El formulario quedó limpio y la disponibilidad fue actualizada.');
      requestAnimationFrame(() => {
        scrollPrincipalRef.current?.scrollTo({ y: 0, animated: true });
      });
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
    const claveAccion = `retiro:${id}`;
    if (accionesEnCursoRef.current.has(claveAccion)) return;
    accionesEnCursoRef.current.add(claveAccion);

    setAccionPedido(id);
    setError('');
    setAviso('');
    try {
      await retirarPedido(token, id, uuidV4());
      await cargar(false);
      setAviso('Pedido retirado. Los productos pasaron a distribución bajo tu custodia.');
    } catch (e) {
      await manejarError(e);
    } finally {
      accionesEnCursoRef.current.delete(claveAccion);
      setAccionPedido(null);
    }
  }

  function abrirMapaPedido(pedido: PedidoResumen) {
    if (!pedido.destinoGps) {
      setError('Este pedido no tiene un destino georreferenciado.');
      return;
    }

    const planActual = planificacion?.paradas.some(
      (parada) => parada.pedidoId === pedido.id,
    )
      ? planificacion
      : null;

    if (planActual) {
      setMapaOperativo({
        origen: planActual.origen,
        paradas: planActual.paradas,
        enfoquePedidoId: pedido.id,
      });
      setError('');
      return;
    }

    setMapaOperativo({
      origen: null,
      enfoquePedidoId: pedido.id,
      paradas: [
        {
          pedidoId: pedido.id,
          clienteId: pedido.cliente.id,
          clienteNombre: pedido.cliente.nombre,
          direccionEntrega: pedido.direccionEntrega,
          latitud: pedido.destinoGps.latitud,
          longitud: pedido.destinoGps.longitud,
          orden: 1,
          distanciaDesdeAnteriorMetros: 0,
        },
      ],
    });
    setError('');
  }

  async function entregar(pedido: PedidoResumen) {
    const claveAccion = `gps-entrega:${pedido.id}`;
    if (accionesEnCursoRef.current.has(claveAccion)) return;
    accionesEnCursoRef.current.add(claveAccion);

    setAccionPedido(pedido.id);
    setError('');
    setAviso('');
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
      accionesEnCursoRef.current.delete(claveAccion);
      setAccionPedido(null);
    }
  }

  async function confirmarEntregaCapturada(
    id: string,
    latitud: number,
    longitud: number,
    precisionMetros?: number,
  ) {
    const claveAccion = `confirmar-entrega:${id}`;
    if (accionesEnCursoRef.current.has(claveAccion)) return;
    accionesEnCursoRef.current.add(claveAccion);

    setAccionPedido(id);
    setError('');
    setAviso('');
    try {
      const entrega = await entregarPedidoConComprobacion(token, id, {
        operacionClave: uuidV4(),
        latitud,
        longitud,
        precisionMetros,
      });
      await cargar(false);

      setPedidosSeleccionados((actuales) => actuales.filter((pedidoId) => pedidoId !== id));
      setPlanificacion((actual) => {
        if (!actual) return actual;
        const restantes = actual.paradas.filter((parada) => parada.pedidoId !== id);
        if (!restantes.length) return null;
        const origen = {
          latitud,
          longitud,
          tipo: 'ACTUAL' as const,
        };
        const recalculadas = recalcularSecuencia(origen, restantes);
        return {
          ...actual,
          origen,
          paradas: recalculadas.paradas,
          distanciaTotalAproximadaMetros: recalculadas.total,
        };
      });
      setMapaOperativo(null);

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
      accionesEnCursoRef.current.delete(claveAccion);
      setAccionPedido(null);
    }
  }

  function alternarPedidoPlanificacion(id: string) {
    setPlanificacion(null);
    setPedidosSeleccionados((actuales) =>
      actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id],
    );
  }

  function seleccionarPedidos(ids: string[]) {
    setPedidosSeleccionados([...new Set(ids)]);
    setPlanificacion(null);
    setError('');
  }

  async function planificarTodosDesdeUbicacionActual(ids: string[]) {
    if (ids.length < 2) {
      setError('Se necesitan al menos dos pedidos pendientes con ubicación confirmada.');
      return;
    }

    setPedidosSeleccionados(ids);
    await generarPlanificacion('ACTUAL', ids);
  }

  async function generarPlanificacion(
    origen: 'DESPACHO' | 'ACTUAL',
    pedidoIds: string[] = pedidosSeleccionados,
  ) {
    if (pedidoIds.length < 2) {
      setError('Selecciona al menos dos pedidos georreferenciados para planificar.');
      return;
    }

    setPlanificando(true);
    setError('');
    try {
      if (origen === 'DESPACHO') {
        setPlanificacion(
          await planificarReparto(token, {
            pedidoIds,
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
          pedidoIds,
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

  async function actualizarPlanDesdeUbicacionActual() {
    if (!planificacion?.paradas.length) return;

    setPlanificando(true);
    setError('');
    try {
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (permiso.status !== 'granted') {
        setError('Se necesita permiso de ubicación para actualizar el recorrido.');
        return;
      }
      const posicion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const origen = {
        latitud: posicion.coords.latitude,
        longitud: posicion.coords.longitude,
        tipo: 'ACTUAL' as const,
      };

      if (planificacion.paradas.length === 1) {
        const recalculadas = recalcularSecuencia(origen, planificacion.paradas);
        setPlanificacion((actual) =>
          actual
            ? {
                ...actual,
                origen,
                paradas: recalculadas.paradas,
                distanciaTotalAproximadaMetros: recalculadas.total,
              }
            : actual,
        );
        return;
      }

      const actualizada = await planificarReparto(token, {
        pedidoIds: planificacion.paradas.map((parada) => parada.pedidoId),
        origenTipo: 'ACTUAL',
        origenLatitud: origen.latitud,
        origenLongitud: origen.longitud,
      });
      setPlanificacion(actualizada);
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
      setPedidosSeleccionados((actuales) =>
        actuales.filter((id) => !registrados.some((pedido) => pedido.id === id)),
      );

      const detalle =
        resultado.fallidos === 0
          ? `${resultado.exitosos} pedido(s) pasaron a reparto.`
          : `${resultado.exitosos} retiro(s) correctos y ${resultado.fallidos} con observaciones.`;

      setAviso(detalle);
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
        ref={scrollPrincipalRef}
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={actualizando} onRefresh={() => void refrescar()} />
        }
      >
        {seccion === 'pedidos' ? (
          <Pedidos
            pedidos={pedidos}
            seleccionados={pedidosSeleccionados}
            planificacion={planificacion}
            planificando={planificando}
            retirando={retirandoSeleccionados}
            accionPedido={accionPedido}
            onAlternar={alternarPedidoPlanificacion}
            onSeleccionarTodos={seleccionarTodosPlanificables}
            onPlanificarTodosActual={() => void planificarTodosDesdeUbicacionActual()}
            onPlanificarDespacho={() => void generarPlanificacion('DESPACHO')}
            onPlanificarActual={() => void generarPlanificacion('ACTUAL')}
            onRetirarSeleccionados={confirmarRetiroSeleccionados}
            onMover={moverParada}
            onRetirar={retirar}
            onEntregar={entregar}
            onVerMapaPedido={(pedido) => void abrirMapaPedido(pedido)}
            onVerMapaPlan={() => planificacion && setMapaOperativo(planificacion)}
            onActualizarUbicacionPlan={() => void actualizarPlanDesdeUbicacionActual()}
          />
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

      {mapaOperativo ? (
        <MapaRepartoModal
          visible
          origen={mapaOperativo.origen}
          paradas={mapaOperativo.paradas}
          onCerrar={() => setMapaOperativo(null)}
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
  seleccionados,
  planificacion,
  planificando,
  retirando,
  accionPedido,
  onAlternar,
  onSeleccionarTodos,
  onPlanificarTodosActual,
  onPlanificarDespacho,
  onPlanificarActual,
  onRetirarSeleccionados,
  onMover,
  onRetirar,
  onEntregar,
  onVerMapaPedido,
  onVerMapaPlan,
  onActualizarUbicacionPlan,
}: {
  pedidos: PedidoResumen[];
  seleccionados: string[];
  planificacion: PlanificacionReparto | null;
  planificando: boolean;
  retirando: boolean;
  accionPedido: string | null;
  onAlternar: (id: string) => void;
  onSeleccionarTodos: () => void;
  onPlanificarTodosActual: () => void;
  onPlanificarDespacho: () => void;
  onPlanificarActual: () => void;
  onRetirarSeleccionados: () => void;
  onMover: (indice: number, direccion: -1 | 1) => void;
  onRetirar: (pedido: PedidoResumen) => void;
  onEntregar: (pedido: PedidoResumen) => void;
  onVerMapaPedido: (pedido: PedidoResumen) => void;
  onVerMapaPlan: () => void;
  onActualizarUbicacionPlan: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | PedidoResumen['estado']>('TODOS');

  const pedidoPorId = useMemo(
    () => new Map(pedidos.map((pedido) => [pedido.id, pedido])),
    [pedidos],
  );
  const pendientes = pedidos.filter((pedido) => pedido.estado !== 'ENTREGADO');
  const planificables = pendientes.filter((pedido) => pedido.destinoGps !== null);
  const sinGps = pendientes.filter((pedido) => pedido.destinoGps === null);
  const puedePlanificar = planificables.length >= 2 && seleccionados.length >= 2;

  const pedidosVisibles = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase('es-BO');
    return pedidos.filter((pedido) => {
      const coincide =
        !consulta ||
        pedido.cliente.nombre.toLocaleLowerCase('es-BO').includes(consulta) ||
        pedido.direccionEntrega.toLocaleLowerCase('es-BO').includes(consulta);
      return coincide && (filtroEstado === 'TODOS' || pedido.estado === filtroEstado);
    });
  }, [busqueda, filtroEstado, pedidos]);

  const idsPlan = new Set(planificacion?.paradas.map((parada) => parada.pedidoId) ?? []);
  const pedidosPlan = (planificacion?.paradas ?? [])
    .map((parada) => pedidoPorId.get(parada.pedidoId))
    .filter((pedido): pedido is PedidoResumen => Boolean(pedido) && pedido!.estado !== 'ENTREGADO');
  const otrosPedidos = pedidosVisibles.filter((pedido) => !idsPlan.has(pedido.id));

  function tarjetaPedido(pedido: PedidoResumen, indicePlan?: number) {
    const enPlan = indicePlan !== undefined;
    const seleccionable = pedido.estado !== 'ENTREGADO' && Boolean(pedido.destinoGps);
    const seleccionado = seleccionados.includes(pedido.id);
    const parada = enPlan ? planificacion?.paradas[indicePlan] : null;

    return (
      <View key={pedido.id} style={[styles.tarjeta, enPlan && styles.tarjetaPlan]}>
        <View style={styles.filaEntre}>
          <View style={styles.flex}>
            <View style={styles.filaTituloPedido}>
              {enPlan ? <Text style={styles.ordenBadge}>{(indicePlan ?? 0) + 1}</Text> : null}
              <Text style={styles.tarjetaTitulo}>{pedido.cliente.nombre}</Text>
            </View>
            <Text style={styles.textoSecundario}>
              {enPlan && parada
                ? `${formatearDistancia(parada.distanciaDesdeAnteriorMetros)} desde el punto anterior`
                : fechaCorta(pedido.creadoEn)}
            </Text>
          </View>
          <Estado estado={pedido.estado} />
        </View>

        <Text style={styles.direccion}>{pedido.direccionEntrega}</Text>

        <View style={styles.resumenPedido}>
          <Dato etiqueta="Unidades" valor={String(pedido.unidades)} />
          <Dato etiqueta="Total" valor={`Bs ${pedido.totalBob}`} />
        </View>

        {!planificacion && seleccionable ? (
          <Pressable
            onPress={() => onAlternar(pedido.id)}
            style={[styles.botonSeleccion, seleccionado && styles.botonSeleccionActivo]}
          >
            <Text style={[styles.botonSeleccionTexto, seleccionado && styles.botonSeleccionTextoActivo]}>
              {seleccionado ? '✓ Incluido en organización' : 'Incluir para organizar'}
            </Text>
          </Pressable>
        ) : null}

        {enPlan ? (
          <View style={styles.fila}>
            <Pressable
              disabled={indicePlan === 0}
              onPress={() => onMover(indicePlan!, -1)}
              style={[styles.botonOrdenAncho, indicePlan === 0 && styles.deshabilitado]}
            >
              <Text style={styles.botonOrdenTexto}>↑ Antes</Text>
            </Pressable>
            <Pressable
              disabled={indicePlan === pedidosPlan.length - 1}
              onPress={() => onMover(indicePlan!, 1)}
              style={[
                styles.botonOrdenAncho,
                indicePlan === pedidosPlan.length - 1 && styles.deshabilitado,
              ]}
            >
              <Text style={styles.botonOrdenTexto}>↓ Después</Text>
            </Pressable>
          </View>
        ) : null}

        {pedido.destinoGps ? (
          <Pressable onPress={() => onVerMapaPedido(pedido)} style={styles.botonMapa}>
            <Text style={styles.botonMapaTexto}>Ver en mapa</Text>
          </Pressable>
        ) : (
          <Text style={styles.alertaInline}>Pedido histórico sin destino GPS.</Text>
        )}

        {pedido.estado === 'REGISTRADO' ? (
          <BotonAccion
            texto="Retirar para reparto"
            cargando={accionPedido === pedido.id}
            onPress={() => onRetirar(pedido)}
          />
        ) : null}

        {pedido.estado === 'EN_DISTRIBUCION' ? (
          <BotonAccion
            texto="Comprobar y confirmar entrega"
            cargando={accionPedido === pedido.id}
            onPress={() => onEntregar(pedido)}
          />
        ) : null}

        {pedido.estado === 'ENTREGADO' && pedido.entregadoEn ? (
          <Text style={styles.confirmado}>Entregado · {fechaCorta(pedido.entregadoEn)}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.bloque}>
      <Titulo
        titulo="Pedidos"
        descripcion="Organiza, retira y entrega desde una sola vista."
      />

      <View style={styles.tarjeta}>
        <View style={styles.resumenPedido}>
          <Dato etiqueta="Total" valor={String(pedidos.length)} />
          <Dato etiqueta="Pendientes" valor={String(pendientes.length)} />
          <Dato etiqueta="Entregados" valor={String(pedidos.length - pendientes.length)} />
        </View>
        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar cliente o dirección"
          placeholderTextColor="#8a8982"
          style={styles.input}
        />
        <View style={styles.filtros}>
          {[
            ['TODOS', 'Todos'],
            ['REGISTRADO', 'Registrados'],
            ['EN_DISTRIBUCION', 'En reparto'],
            ['ENTREGADO', 'Entregados'],
          ].map(([valor, texto]) => (
            <Pressable
              key={valor}
              onPress={() => setFiltroEstado(valor as 'TODOS' | PedidoResumen['estado'])}
              style={[styles.filtroChip, filtroEstado === valor && styles.filtroChipActivo]}
            >
              <Text style={[styles.filtroChipTexto, filtroEstado === valor && styles.filtroChipTextoActivo]}>
                {texto}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {!planificacion && planificables.length >= 2 ? (
        <View style={styles.tarjetaPlanControl}>
          <View style={styles.filaEntre}>
            <View style={styles.flex}>
              <Text style={styles.tarjetaTitulo}>Organizar entregas</Text>
              <Text style={styles.textoSecundario}>
                Selecciona pedidos o usa todos. El orden es una sugerencia por cercanía.
              </Text>
            </View>
            <Pressable onPress={onSeleccionarTodos} style={styles.botonMapaCompacto}>
              <Text style={styles.botonMapaTexto}>Todos</Text>
            </Pressable>
          </View>

          <BotonAccion
            texto={planificando ? 'Calculando…' : 'Organizar todos desde mi ubicación'}
            cargando={planificando}
            onPress={onPlanificarTodosActual}
          />

          {seleccionados.length >= 2 ? (
            <View style={styles.fila}>
              <Pressable
                disabled={!puedePlanificar || planificando}
                onPress={onPlanificarActual}
                style={[styles.botonMapa, (!puedePlanificar || planificando) && styles.deshabilitado]}
              >
                <Text style={styles.botonMapaTexto}>Desde mi ubicación</Text>
              </Pressable>
              <Pressable
                disabled={!puedePlanificar || planificando}
                onPress={onPlanificarDespacho}
                style={[styles.botonMapa, (!puedePlanificar || planificando) && styles.deshabilitado]}
              >
                <Text style={styles.botonMapaTexto}>Desde ZAV</Text>
              </Pressable>
            </View>
          ) : null}

          {seleccionados.some((id) => pedidoPorId.get(id)?.estado === 'REGISTRADO') ? (
            <Pressable
              disabled={retirando}
              onPress={onRetirarSeleccionados}
              style={[styles.botonMapa, retirando && styles.deshabilitado]}
            >
              <Text style={styles.botonMapaTexto}>
                {retirando ? 'Registrando…' : 'Retirar seleccionados'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {sinGps.length ? (
        <Text style={styles.alertaInline}>
          {sinGps.length} pedido(s) histórico(s) no pueden organizarse porque no guardaron GPS.
        </Text>
      ) : null}

      {planificacion && pedidosPlan.length ? (
        <>
          <View style={styles.tarjetaPlanControl}>
            <View style={styles.filaEntre}>
              <View style={styles.flex}>
                <Text style={styles.tarjetaTitulo}>Recorrido activo · {pedidosPlan.length} parada(s)</Text>
                <Text style={styles.textoSecundario}>
                  Aproximado: {formatearDistancia(planificacion.distanciaTotalAproximadaMetros)}
                </Text>
              </View>
              <Text style={styles.estadoMiniOk}>Activo</Text>
            </View>

            <Pressable onPress={onVerMapaPlan} style={styles.mapaPreview}>
              <MapaReparto origen={planificacion.origen} paradas={planificacion.paradas} />
              <View style={styles.mapaPreviewEtiqueta}>
                <Text style={styles.botonMapaTexto}>Abrir mapa completo</Text>
              </View>
            </Pressable>

            <Pressable
              disabled={planificando}
              onPress={onActualizarUbicacionPlan}
              style={[styles.botonMapa, planificando && styles.deshabilitado]}
            >
              <Text style={styles.botonMapaTexto}>
                {planificando ? 'Actualizando…' : 'Actualizar mi ubicación y reordenar'}
              </Text>
            </Pressable>
          </View>

          {pedidosPlan.map((pedido, indice) => tarjetaPedido(pedido, indice))}
        </>
      ) : null}

      {!planificacion && !pedidosVisibles.length ? (
        <Vacio texto="No hay pedidos que coincidan con los filtros." />
      ) : null}

      {!planificacion
        ? pedidosVisibles.map((pedido) => tarjetaPedido(pedido))
        : otrosPedidos.length
          ? (
              <>
                <Text style={styles.seccionTitulo}>Otros pedidos e historial</Text>
                {otrosPedidos.map((pedido) => tarjetaPedido(pedido))}
              </>
            )
          : null}
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
  onAbrirMapa,
  onGuardar,
  clienteEditando,
  editNombre,
  editTelefono,
  editDireccion,
  editUbicacion,
  setEditNombre,
  setEditTelefono,
  onEditar,
  onCancelarEdicion,
  onAbrirMapaEdicion,
  onGuardarEdicion,
}: {
  clientes: Cliente[];
  nombre: string;
  telefono: string;
  direccion: string;
  ubicacion: PuntoGeografico | null;
  guardando: boolean;
  setNombre: (v: string) => void;
  setTelefono: (v: string) => void;
  onAbrirMapa: () => void;
  onGuardar: () => void;
  clienteEditando: Cliente | null;
  editNombre: string;
  editTelefono: string;
  editDireccion: string;
  editUbicacion: PuntoGeografico | null;
  setEditNombre: (v: string) => void;
  setEditTelefono: (v: string) => void;
  onEditar: (cliente: Cliente) => void;
  onCancelarEdicion: () => void;
  onAbrirMapaEdicion: () => void;
  onGuardarEdicion: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroUbicacion, setFiltroUbicacion] = useState<'TODOS' | 'CON' | 'SIN'>('TODOS');
  const editando = Boolean(clienteEditando);
  const formNombre = editando ? editNombre : nombre;
  const formTelefono = editando ? editTelefono : telefono;
  const formDireccion = editando ? editDireccion : direccion;
  const formUbicacion = editando ? editUbicacion : ubicacion;

  const clientesVisibles = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase('es-BO');
    return clientes.filter((cliente) => {
      const coincide =
        !consulta ||
        cliente.nombre.toLocaleLowerCase('es-BO').includes(consulta) ||
        (cliente.telefono ?? '').toLocaleLowerCase('es-BO').includes(consulta) ||
        cliente.direccion.toLocaleLowerCase('es-BO').includes(consulta);
      const coincideUbicacion =
        filtroUbicacion === 'TODOS' ||
        (filtroUbicacion === 'CON' && Boolean(cliente.ubicacion)) ||
        (filtroUbicacion === 'SIN' && !cliente.ubicacion);
      return coincide && coincideUbicacion;
    });
  }, [busqueda, clientes, filtroUbicacion]);

  return (
    <View style={styles.bloque}>
      <Titulo
        titulo="Clientes"
        descripcion="Alta y edición usan el mismo formulario."
      />

      <View style={[styles.tarjeta, editando && styles.tarjetaEdicion]}>
        <View style={styles.filaEntre}>
          <View style={styles.flex}>
            <Text style={styles.seccionTitulo}>
              {editando ? 'Editar cliente' : 'Nuevo cliente'}
            </Text>
            {editando ? (
              <Text style={styles.textoSecundario}>{clienteEditando?.nombre}</Text>
            ) : null}
          </View>
          {editando ? (
            <Pressable onPress={onCancelarEdicion} style={styles.botonMapaCompacto}>
              <Text style={styles.botonMapaTexto}>Cancelar</Text>
            </Pressable>
          ) : null}
        </View>

        <Campo
          label="Nombre"
          value={formNombre}
          onChangeText={editando ? setEditNombre : setNombre}
        />
        <Campo
          label="Teléfono (opcional)"
          value={formTelefono}
          onChangeText={editando ? setEditTelefono : setTelefono}
          keyboardType="phone-pad"
        />

        {formDireccion && formUbicacion ? (
          <View style={styles.ubicacionResumen}>
            <Text style={styles.ubicacionResumenTitulo}>Ubicación confirmada</Text>
            <Text style={styles.direccion}>{formDireccion}</Text>
          </View>
        ) : (
          <Text style={styles.alertaInline}>
            Define la ubicación en Tarija para poder guardar el cliente.
          </Text>
        )}

        <Pressable
          onPress={editando ? onAbrirMapaEdicion : onAbrirMapa}
          style={styles.botonMapa}
        >
          <Text style={styles.botonMapaTexto}>
            {formUbicacion ? 'Revisar ubicación' : 'Definir ubicación'}
          </Text>
        </Pressable>

        <BotonAccion
          texto={editando ? 'Guardar cambios' : 'Guardar cliente'}
          cargando={guardando}
          onPress={editando ? onGuardarEdicion : onGuardar}
        />

        {editando ? (
          <Text style={styles.textoSecundario}>
            Los pedidos ya registrados conservan su destino histórico.
          </Text>
        ) : null}
      </View>

      <View style={styles.tarjeta}>
        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar nombre, teléfono o dirección"
          placeholderTextColor="#8a8982"
          style={styles.input}
        />
        <View style={styles.filtros}>
          {[
            ['TODOS', 'Todos'],
            ['CON', 'Con ubicación'],
            ['SIN', 'Sin ubicación'],
          ].map(([valor, texto]) => (
            <Pressable
              key={valor}
              onPress={() => setFiltroUbicacion(valor as 'TODOS' | 'CON' | 'SIN')}
              style={[styles.filtroChip, filtroUbicacion === valor && styles.filtroChipActivo]}
            >
              <Text style={[styles.filtroChipTexto, filtroUbicacion === valor && styles.filtroChipTextoActivo]}>
                {texto}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.contador}>
          {clientesVisibles.length} de {clientes.length} cliente(s)
        </Text>
      </View>

      {!clientesVisibles.length ? (
        <Vacio texto="No hay clientes que coincidan con los filtros." />
      ) : (
        clientesVisibles.map((cliente) => (
          <View key={cliente.id} style={styles.tarjetaCompacta}>
            <View style={styles.filaEntre}>
              <View style={styles.flex}>
                <Text style={styles.tarjetaTitulo}>{cliente.nombre}</Text>
                {cliente.telefono ? (
                  <Text style={styles.textoSecundario}>{cliente.telefono}</Text>
                ) : null}
              </View>
              <Text style={cliente.ubicacion ? styles.estadoMiniOk : styles.estadoMiniPendiente}>
                {cliente.ubicacion ? 'Ubicado' : 'Sin GPS'}
              </Text>
            </View>
            <Text style={styles.direccion}>{cliente.direccion}</Text>
            <Pressable onPress={() => onEditar(cliente)} style={styles.botonMapaCompacto}>
              <Text style={styles.botonMapaTexto}>Editar</Text>
            </Pressable>
          </View>
        ))
      )}
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
  const [busquedaCliente, setBusquedaCliente] = useState('');

  const clientesFiltrados = useMemo(() => {
    const consulta = busquedaCliente.trim().toLocaleLowerCase('es-BO');
    return clientes.filter((cliente) => {
      if (!cliente.ubicacion) return false;
      return (
        !consulta ||
        cliente.nombre.toLocaleLowerCase('es-BO').includes(consulta) ||
        cliente.direccion.toLocaleLowerCase('es-BO').includes(consulta) ||
        (cliente.telefono ?? '').toLocaleLowerCase('es-BO').includes(consulta)
      );
    });
  }, [busquedaCliente, clientes]);

  const sinUbicacion = clientes.filter((cliente) => !cliente.ubicacion).length;

  return (
    <View style={styles.bloque}>
      <Titulo
        titulo="Nuevo pedido"
        descripcion="Selecciona un cliente con ubicación confirmada y registra solo cantidades con disponibilidad actual."
      />

      <Text style={styles.seccionTitulo}>1. Cliente</Text>
      <View style={styles.tarjeta}>
        <TextInput
          value={busquedaCliente}
          onChangeText={setBusquedaCliente}
          placeholder="Buscar cliente o dirección"
          placeholderTextColor="#8a8982"
          style={styles.input}
        />
        {sinUbicacion ? (
          <Text style={styles.alertaInline}>
            {sinUbicacion} cliente(s) no aparecen aquí porque todavía no tienen ubicación confirmada.
          </Text>
        ) : null}
      </View>

      {!clientesFiltrados.length ? (
        <Vacio texto="No hay clientes con ubicación confirmada que coincidan con la búsqueda." />
      ) : (
        <View style={styles.selectorLista}>
          {clientesFiltrados.map((cliente) => {
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
                <Text style={styles.disponible}>Ubicación confirmada</Text>
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
  tarjetaPlan: {
    borderColor: '#d9a28f',
    backgroundColor: '#fffaf7',
  },
  tarjetaPlanControl: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9a28f',
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  tarjetaEdicion: {
    borderColor: '#d9a28f',
    backgroundColor: '#fffaf7',
  },
  filaTituloPedido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  ordenBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#b83b17',
    color: '#fff',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: '900',
    paddingTop: 5,
  },
  botonSeleccion: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
  },
  botonSeleccionActivo: {
    borderColor: '#b83b17',
    backgroundColor: '#fdf0e9',
  },
  botonSeleccionTexto: {
    color: '#66665e',
    fontSize: 11,
    fontWeight: '800',
  },
  botonSeleccionTextoActivo: {
    color: '#b83b17',
  },
  botonOrdenAncho: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  mapaPreview: {
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  mapaPreviewEtiqueta: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#d9a28f',
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
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  filtroChip: {
    borderWidth: 1,
    borderColor: '#c6c5bd',
    backgroundColor: '#fff',
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  filtroChipActivo: {
    borderColor: '#b83b17',
    backgroundColor: '#fdf0e9',
  },
  filtroChipTexto: {
    color: '#66665e',
    fontSize: 11,
    fontWeight: '700',
  },
  filtroChipTextoActivo: {
    color: '#b83b17',
  },
  ubicacionResumen: {
    borderWidth: 1,
    borderColor: '#c9dfd0',
    backgroundColor: '#eef7f1',
    borderRadius: 8,
    padding: 11,
    gap: 4,
  },
  ubicacionResumenTitulo: {
    color: '#286344',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alertaInline: {
    color: '#8b4a2f',
    backgroundColor: '#fff3e9',
    borderRadius: 7,
    padding: 9,
    fontSize: 11,
    lineHeight: 16,
  },
  enlaceSecundario: {
    color: '#b83b17',
    fontSize: 12,
    fontWeight: '800',
  },
  estadoMiniOk: {
    color: '#286344',
    backgroundColor: '#eaf4ed',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '800',
  },
  estadoMiniPendiente: {
    color: '#8b4a2f',
    backgroundColor: '#fff3e9',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '800',
  },
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

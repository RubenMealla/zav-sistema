import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
  actualizarPedido,
  cancelarPedido,
  cambiarEstadoCliente,
  crearCliente,
  crearPedido,
  entregarPedidoConComprobacion,
  listarDirectorioClientes,
  listarPedidos,
  listarPedidosActivos,
  obtenerDisponibilidad,
  obtenerPedido,
  planificarReparto,
  retirarPedido,
  retirarPedidosSeleccionados,
} from '@/lib/api';
import type {
  Cliente,
  Disponibilidad,
  PedidoDetalle,
  PedidoResumen,
  PlanificacionParada,
  PlanificacionReparto,
  PuntoGeografico,
  Sesion,
} from '@/lib/tipos';
import { uuidV4 } from '@/lib/uuid';
import { MapaReparto, MapaRepartoModal, SelectorUbicacionMapa } from '@/components/mapas-distribucion';
import { HistorialPedidosModal } from '@/components/historial-pedidos';
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
  if (error instanceof ApiError) {
    const mensaje = error.message.toLocaleLowerCase('es-BO');
    if (
      error.status === 400 &&
      (mensaje.includes('estado de pedido no valido') ||
        mensaje.includes('campos no permitidos'))
    ) {
      return 'La API de desarrollo no está alineada con esta versión de la aplicación. Actualiza los datos e inténtalo nuevamente.';
    }
    if (error.status === 404 && error.body?.path?.includes('/estado')) {
      return 'La gestión de estado de clientes todavía no está disponible en la API conectada.';
    }
    return error.message;
  }
  return 'Ocurrió un error inesperado.';
}

function estadoLegible(estado: PedidoResumen['estado']) {
  if (estado === 'REGISTRADO') return 'Por retirar';
  if (estado === 'EN_DISTRIBUCION') return 'Para entregar';
  if (estado === 'CANCELADO') return 'Anulado';
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
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [cargandoMasPedidos, setCargandoMasPedidos] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [notificacionTop, setNotificacionTop] = useState(112);
  const [historialVisible, setHistorialVisible] = useState(false);
  const [historialPedidos, setHistorialPedidos] = useState<PedidoResumen[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [historialMensaje, setHistorialMensaje] = useState('');

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
  const [pedidoEditando, setPedidoEditando] = useState<PedidoDetalle | null>(null);
  const [cargandoEdicionPedido, setCargandoEdicionPedido] = useState<string | null>(null);
  const [cambiandoEstadoCliente, setCambiandoEstadoCliente] = useState<string | null>(null);
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

  const cerrarNotificacion = useCallback(() => {
    setError('');
    setAviso('');
  }, []);

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
    async () =>
      Promise.allSettled([
        listarPedidosActivos(token),
        listarDirectorioClientes(token),
        obtenerDisponibilidad(token),
      ]),
    [token],
  );

  const cargar = useCallback(
    async (mostrarCarga = true) => {
      if (mostrarCarga) setCargando(true);
      setError('');

      try {
        const [pedidosResultado, clientesResultado, disponibilidadResultado] =
          await consultarDatos();

        const errores: { recurso: string; error: unknown }[] = [];

        if (pedidosResultado.status === 'fulfilled') {
          setPedidos(pedidosResultado.value.items);
          setTotalPedidos(pedidosResultado.value.total);
        } else {
          errores.push({ recurso: 'pedidos', error: pedidosResultado.reason });
        }

        if (clientesResultado.status === 'fulfilled') {
          setClientes(clientesResultado.value.items);
        } else {
          errores.push({ recurso: 'clientes', error: clientesResultado.reason });
        }

        if (disponibilidadResultado.status === 'fulfilled') {
          setDisponibilidad(disponibilidadResultado.value);
        } else {
          errores.push({ recurso: 'productos', error: disponibilidadResultado.reason });
        }

        const errorSesion = errores.find(
          ({ error }) =>
            error instanceof ApiError && (error.status === 401 || error.status === 403),
        );
        if (errorSesion) {
          await manejarError(errorSesion.error);
          return;
        }

        if (errores.length) {
          const detalle = errores
            .map(({ recurso, error }) => `${recurso}: ${mensajeError(error)}`)
            .join(' · ');
          setError(`No se pudo actualizar ${detalle}`);
        }
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
      setError('');
      const [pedidosResultado, clientesResultado, disponibilidadResultado] =
        await consultarDatos();

      if (!activa) return;

      const errores: { recurso: string; error: unknown }[] = [];

      if (pedidosResultado.status === 'fulfilled') {
        setPedidos(pedidosResultado.value.items);
        setTotalPedidos(pedidosResultado.value.total);
      } else {
        errores.push({ recurso: 'pedidos', error: pedidosResultado.reason });
      }

      if (clientesResultado.status === 'fulfilled') {
        setClientes(clientesResultado.value.items);
      } else {
        errores.push({ recurso: 'clientes', error: clientesResultado.reason });
      }

      if (disponibilidadResultado.status === 'fulfilled') {
        setDisponibilidad(disponibilidadResultado.value);
      } else {
        errores.push({ recurso: 'productos', error: disponibilidadResultado.reason });
      }

      const errorSesion = errores.find(
        ({ error }) =>
          error instanceof ApiError && (error.status === 401 || error.status === 403),
      );
      if (errorSesion) {
        await manejarError(errorSesion.error);
      } else if (errores.length) {
        const detalle = errores
          .map(({ recurso, error }) => `${recurso}: ${mensajeError(error)}`)
          .join(' · ');
        setError(`No se pudo actualizar ${detalle}`);
      }

      if (activa) setCargando(false);
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

  async function cargarMasPedidos() {
    if (cargandoMasPedidos || pedidos.length >= totalPedidos) return;

    setCargandoMasPedidos(true);
    setError('');
    try {
      const respuesta = await listarPedidosActivos(token);
      setPedidos(respuesta.items);
      setTotalPedidos(respuesta.total);
    } catch (e) {
      await manejarError(e);
    } finally {
      setCargandoMasPedidos(false);
    }
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
      setAviso('Cliente registrado. Ya está disponible para nuevos pedidos.');
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
      setAviso('Cliente actualizado. Los pedidos históricos conservan su destino original.');
    } catch (e) {
      await manejarError(e);
    } finally {
      setGuardandoCliente(false);
    }
  }

  function confirmarCambioEstadoCliente(cliente: Cliente) {
    const activar = !cliente.activo;
    Alert.alert(
      activar ? 'Reactivar cliente' : 'Desactivar cliente',
      activar
        ? `¿Reactivar a ${cliente.nombre} para permitir nuevos pedidos?`
        : `¿Desactivar a ${cliente.nombre}? Permanecerá en el historial, pero no podrá seleccionarse en pedidos nuevos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: activar ? 'Reactivar' : 'Desactivar',
          style: activar ? 'default' : 'destructive',
          onPress: () => void cambiarEstadoClienteDesdeApp(cliente, activar),
        },
      ],
    );
  }

  async function cambiarEstadoClienteDesdeApp(cliente: Cliente, activo: boolean) {
    if (cambiandoEstadoCliente) return;
    setCambiandoEstadoCliente(cliente.id);
    setError('');
    try {
      const actualizado = await cambiarEstadoCliente(token, cliente.id, activo);
      setClientes((actuales) =>
        actuales
          .map((item) => (item.id === actualizado.id ? actualizado : item))
          .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      if (!activo && clienteSeleccionado === cliente.id) setClienteSeleccionado('');
      if (!activo && clienteEditando?.id === cliente.id) cancelarEdicionCliente();
      setAviso(
        activo
          ? 'Cliente reactivado y disponible para nuevos pedidos.'
          : 'Cliente desactivado. Su historial permanece conservado.',
      );
    } catch (e) {
      await manejarError(e);
    } finally {
      setCambiandoEstadoCliente(null);
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
    if (!clienteActual?.activo || !clienteActual.ubicacion) {
      setError('El cliente seleccionado debe estar activo y tener ubicación confirmada.');
      return;
    }

    const productosFormulario = pedidoEditando
      ? disponibilidad.map((producto) => ({
          ...producto,
          cantidadDisponible:
            producto.cantidadDisponible +
            (pedidoEditando.detalles.find((detalle) => detalle.productoId === producto.productoId)?.cantidad ?? 0),
        }))
      : disponibilidad;

    const detalles = productosFormulario
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
      const producto = productosFormulario.find((p) => p.productoId === detalle.productoId);
      return !producto || detalle.cantidad > producto.cantidadDisponible;
    });
    if (invalido) {
      setError('Una de las cantidades supera la disponibilidad permitida.');
      return;
    }

    setGuardandoPedido(true);
    setError('');
    try {
      if (pedidoEditando) {
        await actualizarPedido(token, pedidoEditando.id, {
          clienteId: clienteSeleccionado,
          observacion: observacion.trim() || undefined,
          detalles,
        });
        setPedidoEditando(null);
        setPlanificacion(null);
        setPedidosSeleccionados([]);
        setSeccion('pedidos');
        setAviso('Pedido corregido. La organización activa se reinició para usar los datos actualizados.');
      } else {
        await crearPedido(token, {
          clienteId: clienteSeleccionado,
          observacion: observacion.trim() || undefined,
          detalles,
        });
        setAviso('Pedido registrado. El formulario quedó listo para el siguiente pedido.');
      }
      setClienteSeleccionado('');
      setObservacion('');
      setCantidades({});
      await cargar(false);
      requestAnimationFrame(() => scrollPrincipalRef.current?.scrollTo({ y: 0, animated: true }));
    } catch (e) {
      await manejarError(e);
    } finally {
      setGuardandoPedido(false);
    }
  }

  async function iniciarEdicionPedido(pedido: PedidoResumen) {
    if (pedido.estado !== 'REGISTRADO') {
      setError('Solo se pueden corregir pedidos que todavía no fueron retirados.');
      return;
    }
    setCargandoEdicionPedido(pedido.id);
    setError('');
    try {
      const detalle = await obtenerPedido(token, pedido.id);
      setPedidoEditando(detalle);
      setClienteSeleccionado(detalle.cliente.id);
      setObservacion(detalle.observacion ?? '');
      setCantidades(
        Object.fromEntries(detalle.detalles.map((item) => [item.productoId, String(item.cantidad)])),
      );
      setSeccion('nuevo');
      setAviso('Modo edición activo: corrige el pedido antes de retirarlo.');
      requestAnimationFrame(() => scrollPrincipalRef.current?.scrollTo({ y: 0, animated: true }));
    } catch (e) {
      await manejarError(e);
    } finally {
      setCargandoEdicionPedido(null);
    }
  }

  function cancelarEdicionPedidoFormulario() {
    setPedidoEditando(null);
    setClienteSeleccionado('');
    setObservacion('');
    setCantidades({});
    setAviso('Edición cancelada. El pedido no fue modificado.');
  }

  function confirmarAnulacionPedido(pedido: PedidoResumen) {
    Alert.alert(
      'Anular pedido',
      `¿Anular el pedido de ${pedido.cliente.nombre}? Se conservará en el historial y se liberará su compromiso de stock.`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Anular pedido',
          style: 'destructive',
          onPress: () => void anularPedido(pedido.id),
        },
      ],
    );
  }

  async function anularPedido(id: string) {
    const claveAccion = `cancelar:${id}`;
    if (accionesEnCursoRef.current.has(claveAccion)) return;
    accionesEnCursoRef.current.add(claveAccion);
    setAccionPedido(id);
    setError('');
    try {
      await cancelarPedido(token, id, 'Registro incorrecto anulado antes del retiro');
      setPedidosSeleccionados((actuales) => actuales.filter((pedidoId) => pedidoId !== id));
      setPlanificacion(null);
      await cargar(false);
      setAviso('Pedido anulado. Se conserva en el historial y dejó de comprometer stock.');
    } catch (e) {
      await manejarError(e);
    } finally {
      accionesEnCursoRef.current.delete(claveAccion);
      setAccionPedido(null);
    }
  }

  async function abrirHistorialPedidos() {
    setHistorialVisible(true);
    setCargandoHistorial(true);
    setHistorialMensaje('');
    setError('');

    try {
      const [entregadosResultado, canceladosResultado] = await Promise.allSettled([
        listarPedidos(token, 'ENTREGADO', 1, 100),
        listarPedidos(token, 'CANCELADO', 1, 100),
      ]);

      if (entregadosResultado.status === 'rejected') {
        throw entregadosResultado.reason;
      }

      const cancelados =
        canceladosResultado.status === 'fulfilled'
          ? canceladosResultado.value.items
          : [];

      if (canceladosResultado.status === 'rejected') {
        const errorCancelados = canceladosResultado.reason;
        if (
          errorCancelados instanceof ApiError &&
          (errorCancelados.status === 400 || errorCancelados.status === 404)
        ) {
          setHistorialMensaje(
            'Los pedidos entregados están disponibles. La consulta de anulados requiere la versión actual del backend.',
          );
        } else {
          setHistorialMensaje(
            'Los pedidos entregados están disponibles, pero no fue posible consultar los anulados.',
          );
        }
      }

      setHistorialPedidos(
        [...entregadosResultado.value.items, ...cancelados].sort(
          (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime(),
        ),
      );
    } catch (e) {
      await manejarError(e);
    } finally {
      setCargandoHistorial(false);
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
        setError('Activa la ubicación del teléfono y vuelve a intentar la entrega.');
        return;
      }

      const permiso = await Location.requestForegroundPermissionsAsync();
      if (permiso.status !== 'granted') {
        setError('La entrega no se registró porque no se autorizó la ubicación puntual.');
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
      setAviso(
        distancia === null || distancia === undefined
          ? 'Entrega registrada con su ubicación puntual.'
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

  async function agregarPedidosAlPlan(ids: string[]) {
    if (!planificacion?.paradas.length) return;

    const existentes = planificacion.paradas.map((parada) => parada.pedidoId);
    const nuevosValidos = ids.filter((pedidoId) => {
      const pedido = pedidos.find((item) => item.id === pedidoId);
      return Boolean(pedido && pedido.estado !== 'ENTREGADO' && pedido.destinoGps);
    });
    const combinados = [...new Set([...existentes, ...nuevosValidos])];

    if (combinados.length === existentes.length) {
      setAviso('No hay pedidos nuevos con ubicación para añadir al recorrido.');
      return;
    }

    setPlanificando(true);
    setError('');
    setAviso('');
    try {
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (permiso.status !== 'granted') {
        setError('Se necesita permiso de ubicación para recalcular el recorrido.');
        return;
      }

      const posicion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const actualizada = await planificarReparto(token, {
        pedidoIds: combinados,
        origenTipo: 'ACTUAL',
        origenLatitud: posicion.coords.latitude,
        origenLongitud: posicion.coords.longitude,
      });

      setPlanificacion(actualizada);
      setPedidosSeleccionados(combinados);
      setMapaOperativo(null);
      setAviso(
        `${combinados.length - existentes.length} pedido(s) nuevo(s) añadidos y recorrido recalculado desde tu ubicación.`,
      );
    } catch (e) {
      await manejarError(e);
    } finally {
      setPlanificando(false);
    }
  }

  async function ejecutarRetiroSeleccionados(ids: string[]) {
    const registrados = pedidos.filter(
      (pedido) =>
        ids.includes(pedido.id) &&
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

  function confirmarRetiroSeleccionados(ids: string[]) {
    const cantidad = pedidos.filter(
      (pedido) =>
        ids.includes(pedido.id) &&
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
            void ejecutarRetiroSeleccionados(ids);
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

  const productosFormularioPedido = useMemo(() => {
    if (!pedidoEditando) return disponibilidad;
    const originales = new Map(
      pedidoEditando.detalles.map((detalle) => [detalle.productoId, detalle.cantidad]),
    );
    return disponibilidad.map((item) => ({
      ...item,
      cantidadDisponible:
        item.cantidadDisponible + (originales.get(item.productoId) ?? 0),
    }));
  }, [disponibilidad, pedidoEditando]);

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

      <View
        style={styles.tabs}
        onLayout={({ nativeEvent }) =>
          setNotificacionTop(nativeEvent.layout.y + nativeEvent.layout.height + 8)
        }
      >
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

      {error || aviso ? (
        <NotificacionEstado
          tipo={error ? 'error' : 'exito'}
          mensaje={error || aviso}
          top={notificacionTop}
          onCerrar={cerrarNotificacion}
        />
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
            totalPedidos={totalPedidos}
            cargandoMasPedidos={cargandoMasPedidos}
            seleccionados={pedidosSeleccionados}
            planificacion={planificacion}
            planificando={planificando}
            retirando={retirandoSeleccionados}
            accionPedido={accionPedido}
            onAlternar={alternarPedidoPlanificacion}
            onSeleccionarPedidos={seleccionarPedidos}
            onPlanificarTodosActual={(ids) => void planificarTodosDesdeUbicacionActual(ids)}
            onPlanificarDespacho={(ids) => void generarPlanificacion('DESPACHO', ids)}
            onPlanificarActual={(ids) => void generarPlanificacion('ACTUAL', ids)}
            onRetirarSeleccionados={(ids) => confirmarRetiroSeleccionados(ids)}
            onCancelarPlan={() => {
              setPlanificacion(null);
              setPedidosSeleccionados([]);
            }}
            onMover={moverParada}
            onRetirar={retirar}
            onEntregar={entregar}
            onVerMapaPedido={abrirMapaPedido}
            onVerMapaPlan={() =>
              planificacion &&
              setMapaOperativo({
                origen: planificacion.origen,
                paradas: planificacion.paradas,
                enfoquePedidoId: null,
              })
            }
            onActualizarUbicacionPlan={() => void actualizarPlanDesdeUbicacionActual()}
            onAgregarPedidosAlPlan={(ids) => void agregarPedidosAlPlan(ids)}
            onCargarMas={() => void cargarMasPedidos()}
            onAbrirHistorial={() => void abrirHistorialPedidos()}
            onEditar={(pedido) => void iniciarEdicionPedido(pedido)}
            onAnular={confirmarAnulacionPedido}
            cargandoEdicionPedido={cargandoEdicionPedido}
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
            onCambiarEstado={confirmarCambioEstadoCliente}
            cambiandoEstadoId={cambiandoEstadoCliente}
          />
        ) : null}

        {seccion === 'nuevo' ? (
          <NuevoPedido
            clientes={clientes}
            productos={productosFormularioPedido}
            clienteSeleccionado={clienteSeleccionado}
            observacion={observacion}
            cantidades={cantidades}
            guardando={guardandoPedido}
            setClienteSeleccionado={setClienteSeleccionado}
            setObservacion={setObservacion}
            setCantidades={setCantidades}
            onAbrirClientes={() => setSelectorClientePedidoVisible(true)}
            onAbrirProductos={() => setSelectorProductosPedidoVisible(true)}
            onGuardar={guardarPedido}
            editando={Boolean(pedidoEditando)}
            onCancelarEdicion={cancelarEdicionPedidoFormulario}
          />
        ) : null}
      </ScrollView>

      <SelectorClientePedidoModal
        visible={selectorClientePedidoVisible}
        clientes={clientes}
        seleccionadoId={clienteSeleccionado}
        onCerrar={() => setSelectorClientePedidoVisible(false)}
        onSeleccionar={(clienteId) => {
          setClienteSeleccionado(clienteId);
          setSelectorClientePedidoVisible(false);
          setError('');
        }}
      />

      <SelectorProductosPedidoModal
        visible={selectorProductosPedidoVisible}
        productos={productosFormularioPedido}
        cantidades={cantidades}
        onCerrar={() => setSelectorProductosPedidoVisible(false)}
        onCambiarCantidad={(productoId, cantidad) =>
          setCantidades((actuales) => ({ ...actuales, [productoId]: cantidad }))
        }
      />

      <HistorialPedidosModal
        visible={historialVisible}
        pedidos={historialPedidos}
        cargando={cargandoHistorial}
        mensaje={historialMensaje}
        onCerrar={() => setHistorialVisible(false)}
      />

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
          enfoquePedidoId={mapaOperativo.enfoquePedidoId}
          onCerrar={() => setMapaOperativo(null)}
        />
      ) : null}
    </View>
  );
}

function NotificacionEstado({
  tipo,
  mensaje,
  top,
  onCerrar,
}: {
  tipo: 'error' | 'exito';
  mensaje: string;
  top: number;
  onCerrar: () => void;
}) {
  const esError = tipo === 'error';
  const progreso = useRef(new Animated.Value(0)).current;
  const cerrandoRef = useRef(false);

  const cerrarAnimado = useCallback(() => {
    if (cerrandoRef.current) return;
    cerrandoRef.current = true;
    Animated.timing(progreso, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onCerrar());
  }, [onCerrar, progreso]);

  useEffect(() => {
    cerrandoRef.current = false;
    progreso.setValue(0);
    Animated.spring(progreso, {
      toValue: 1,
      damping: 18,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: true,
    }).start();

    const temporizador = setTimeout(cerrarAnimado, esError ? 5200 : 3800);
    return () => clearTimeout(temporizador);
  }, [cerrarAnimado, esError, mensaje, progreso]);

  return (
    <View pointerEvents="box-none" style={[styles.notificacionZona, { top }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.notificacion,
          esError ? styles.notificacionError : styles.notificacionExito,
          {
            opacity: progreso,
            transform: [
              {
                translateY: progreso.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.notificacionIcono,
            esError ? styles.notificacionIconoError : styles.notificacionIconoExito,
          ]}
        >
          <Text style={styles.notificacionIconoTexto}>{esError ? '!' : '✓'}</Text>
        </View>
        <View style={styles.flex}>
          <Text
            style={[
              styles.notificacionTitulo,
              esError ? styles.notificacionTituloError : styles.notificacionTituloExito,
            ]}
          >
            {esError ? 'No se pudo completar' : 'Operación completada'}
          </Text>
          <Text style={styles.notificacionMensaje}>{mensaje}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar notificación"
          hitSlop={10}
          onPress={cerrarAnimado}
          style={styles.notificacionCerrar}
        >
          <Text style={styles.notificacionCerrarTexto}>×</Text>
        </Pressable>
      </Animated.View>
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
  totalPedidos,
  cargandoMasPedidos,
  seleccionados,
  planificacion,
  planificando,
  retirando,
  accionPedido,
  onAlternar,
  onSeleccionarPedidos,
  onPlanificarTodosActual,
  onPlanificarDespacho,
  onPlanificarActual,
  onRetirarSeleccionados,
  onCancelarPlan,
  onMover,
  onRetirar,
  onEntregar,
  onVerMapaPedido,
  onVerMapaPlan,
  onActualizarUbicacionPlan,
  onAgregarPedidosAlPlan,
  onCargarMas,
  onAbrirHistorial,
  onEditar,
  onAnular,
  cargandoEdicionPedido,
}: {
  pedidos: PedidoResumen[];
  totalPedidos: number;
  cargandoMasPedidos: boolean;
  seleccionados: string[];
  planificacion: PlanificacionReparto | null;
  planificando: boolean;
  retirando: boolean;
  accionPedido: string | null;
  onAlternar: (id: string) => void;
  onSeleccionarPedidos: (ids: string[]) => void;
  onPlanificarTodosActual: (ids: string[]) => void;
  onPlanificarDespacho: (ids: string[]) => void;
  onPlanificarActual: (ids: string[]) => void;
  onRetirarSeleccionados: (ids: string[]) => void;
  onCancelarPlan: () => void;
  onMover: (indice: number, direccion: -1 | 1) => void;
  onRetirar: (pedido: PedidoResumen) => void;
  onEntregar: (pedido: PedidoResumen) => void;
  onVerMapaPedido: (pedido: PedidoResumen) => void;
  onVerMapaPlan: () => void;
  onActualizarUbicacionPlan: () => void;
  onAgregarPedidosAlPlan: (ids: string[]) => void;
  onCargarMas: () => void;
  onAbrirHistorial: () => void;
  onEditar: (pedido: PedidoResumen) => void;
  onAnular: (pedido: PedidoResumen) => void;
  cargandoEdicionPedido: string | null;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | PedidoResumen['estado']>('TODOS');
  const [filtroPeriodo, setFiltroPeriodo] = useState<'HOY' | 'TODOS'>('HOY');

  const pedidoPorId = useMemo(
    () => new Map(pedidos.map((pedido) => [pedido.id, pedido])),
    [pedidos],
  );

  const pedidosPeriodo = useMemo(
    () => (filtroPeriodo === 'HOY' ? pedidos.filter((pedido) => esHoyBolivia(pedido.creadoEn)) : pedidos),
    [filtroPeriodo, pedidos],
  );

  const pedidosVisibles = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase('es-BO');
    return pedidosPeriodo.filter((pedido) => {
      const coincide =
        !consulta ||
        pedido.cliente.nombre.toLocaleLowerCase('es-BO').includes(consulta) ||
        pedido.direccionEntrega.toLocaleLowerCase('es-BO').includes(consulta);
      return coincide && (filtroEstado === 'TODOS' || pedido.estado === filtroEstado);
    });
  }, [busqueda, filtroEstado, pedidosPeriodo]);

  const registradosPeriodo = pedidosPeriodo.filter((pedido) => pedido.estado === 'REGISTRADO');
  const distribucionPeriodo = pedidosPeriodo.filter((pedido) => pedido.estado === 'EN_DISTRIBUCION');
  const planificablesVisibles = pedidosVisibles.filter(
    (pedido) =>
      pedido.estado !== 'ENTREGADO' &&
      pedido.estado !== 'CANCELADO' &&
      pedido.destinoGps !== null,
  );
  const sinGpsVisibles = pedidosVisibles.filter(
    (pedido) =>
      pedido.estado !== 'ENTREGADO' &&
      pedido.estado !== 'CANCELADO' &&
      pedido.destinoGps === null,
  );

  const idsVisibles = new Set(pedidosVisibles.map((pedido) => pedido.id));
  const idsSeleccionadosPlanificables = seleccionados.filter((id) => {
    const pedido = pedidoPorId.get(id);
    return Boolean(
      idsVisibles.has(id) &&
      pedido &&
      pedido.estado !== 'ENTREGADO' &&
      pedido.destinoGps,
    );
  });
  const idsSeleccionadosRegistrados = seleccionados.filter(
    (id) => idsVisibles.has(id) && pedidoPorId.get(id)?.estado === 'REGISTRADO',
  );
  const cantidadSeleccionadosRegistrados = idsSeleccionadosRegistrados.length;
  const puedePlanificar = idsSeleccionadosPlanificables.length >= 2;

  const idsPlan = new Set(planificacion?.paradas.map((parada) => parada.pedidoId) ?? []);
  const pedidosPlan = (planificacion?.paradas ?? [])
    .map((parada) => pedidoPorId.get(parada.pedidoId))
    .filter((pedido): pedido is PedidoResumen => Boolean(pedido) && pedido!.estado !== 'ENTREGADO' && pedido!.estado !== 'CANCELADO');
  const otrosPedidos = pedidosVisibles.filter((pedido) => !idsPlan.has(pedido.id));
  const nuevosParaPlan = pedidosPeriodo.filter(
    (pedido) =>
      pedido.estado !== 'ENTREGADO' &&
      pedido.estado !== 'CANCELADO' &&
      pedido.destinoGps !== null &&
      !idsPlan.has(pedido.id),
  );

  function tarjetaPedido(pedido: PedidoResumen, indicePlan?: number) {
    const enPlan = indicePlan !== undefined;
    const seleccionable = pedido.estado !== 'ENTREGADO' && pedido.estado !== 'CANCELADO' && Boolean(pedido.destinoGps);
    const seleccionado = seleccionados.includes(pedido.id);
    const parada = enPlan ? planificacion?.paradas[indicePlan] : null;

    return (
      <View
        key={pedido.id}
        style={[
          styles.tarjeta,
          pedido.estado === 'REGISTRADO' && styles.tarjetaPorRetirar,
          pedido.estado === 'EN_DISTRIBUCION' && styles.tarjetaParaEntregar,
          enPlan && styles.tarjetaPlan,
        ]}
      >
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

        <Text
          style={[
            styles.accionPendiente,
            pedido.estado === 'REGISTRADO'
              ? styles.accionPendienteRetiro
              : styles.accionPendienteEntrega,
          ]}
        >
          {pedido.estado === 'REGISTRADO'
            ? 'PENDIENTE DE RETIRO'
            : pedido.estado === 'EN_DISTRIBUCION'
              ? 'LISTO PARA CONFIRMAR ENTREGA'
              : estadoLegible(pedido.estado).toUpperCase()}
        </Text>

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
              {seleccionado ? '✓ Seleccionado' : 'Seleccionar para acciones'}
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
            <Text style={styles.botonMapaTexto}>
              {enPlan ? 'Ver parada en mapa' : 'Ver destino'}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.alertaInline}>Pedido histórico sin destino GPS.</Text>
        )}

        {pedido.estado === 'REGISTRADO' ? (
          <>
            <View style={styles.fila}>
              <Pressable
                disabled={cargandoEdicionPedido === pedido.id || accionPedido === pedido.id}
                onPress={() => onEditar(pedido)}
                style={[styles.botonAccionSecundario, styles.flex, cargandoEdicionPedido === pedido.id && styles.deshabilitado]}
              >
                <Text style={styles.botonAccionSecundarioTexto}>
                  {cargandoEdicionPedido === pedido.id ? 'Cargando…' : 'Editar pedido'}
                </Text>
              </Pressable>
              <Pressable
                disabled={accionPedido === pedido.id}
                onPress={() => onAnular(pedido)}
                style={[styles.botonAccionSecundario, styles.flex]}
              >
                <Text style={styles.botonAnularTexto}>Anular</Text>
              </Pressable>
            </View>
            <BotonAccion
              texto="Retirar para reparto"
              textoCargando="Registrando retiro…"
              cargando={accionPedido === pedido.id}
              onPress={() => onRetirar(pedido)}
            />
          </>
        ) : null}

        {pedido.estado === 'EN_DISTRIBUCION' ? (
          <BotonAccion
            texto="Confirmar entrega"
            textoCargando="Obteniendo ubicación…"
            cargando={accionPedido === pedido.id}
            onPress={() => onEntregar(pedido)}
            variante="entrega"
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
      <View style={styles.filaEntre}>
        <View style={styles.flex}>
          <Titulo
            titulo="Pedidos"
            descripcion="Aquí solo se muestran pedidos pendientes de retiro o entrega."
          />
        </View>
        <Pressable onPress={onAbrirHistorial} style={styles.botonHistorial}>
          <Text style={styles.botonHistorialTexto}>Historial</Text>
        </Pressable>
      </View>

      <View style={styles.tarjeta}>
        <View style={styles.resumenPedido}>
          <Dato etiqueta={filtroPeriodo === 'HOY' ? 'Activos hoy' : 'Activos'} valor={String(pedidosPeriodo.length)} />
          <Dato etiqueta="Por retirar" valor={String(registradosPeriodo.length)} />
          <Dato etiqueta="Para entregar" valor={String(distribucionPeriodo.length)} />
        </View>

        <View style={styles.filtrosGrid}>
          {[
            ['HOY', 'Hoy'],
            ['TODOS', 'Todos activos'],
          ].map(([valor, texto]) => (
            <Pressable
              key={valor}
              onPress={() => setFiltroPeriodo(valor as 'HOY' | 'TODOS')}
              style={[
                styles.filtroChip,
                styles.filtroChipMitad,
                filtroPeriodo === valor && styles.filtroChipActivo,
              ]}
            >
              <Text style={[styles.filtroChipTexto, filtroPeriodo === valor && styles.filtroChipTextoActivo]}>
                {texto}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar cliente o dirección"
          placeholderTextColor="#8a8982"
          style={styles.input}
        />

        <View style={styles.filtrosGrid}>
          {[
            ['TODOS', 'Todos activos'],
            ['REGISTRADO', 'Por retirar'],
            ['EN_DISTRIBUCION', 'Para entregar'],
          ].map(([valor, texto]) => (
            <Pressable
              key={valor}
              onPress={() => setFiltroEstado(valor as 'TODOS' | PedidoResumen['estado'])}
              style={[
                styles.filtroChip,
                styles.filtroChipTercio,
                filtroEstado === valor && styles.filtroChipActivo,
              ]}
            >
              <Text style={[styles.filtroChipTexto, filtroEstado === valor && styles.filtroChipTextoActivo]}>
                {texto}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.contador}>
          {pedidosVisibles.length} pedido(s) visibles
        </Text>
      </View>

      {!planificacion && planificablesVisibles.length ? (
        <View style={styles.tarjetaPlanControl}>
          <View style={styles.filaEntre}>
            <View style={styles.flex}>
              <Text style={styles.tarjetaTitulo}>Acciones</Text>
              <Text style={styles.textoSecundario}>
                {seleccionados.length
                  ? `${seleccionados.length} seleccionado(s)`
                  : `${planificablesVisibles.length} disponible(s)`}
              </Text>
            </View>
          </View>

          <View style={styles.fila}>
            {planificablesVisibles.length >= 2 && !seleccionados.length ? (
              <Pressable
                disabled={planificando}
                onPress={() =>
                  onPlanificarTodosActual(planificablesVisibles.map((pedido) => pedido.id))
                }
                style={[styles.botonMapa, planificando && styles.deshabilitado]}
              >
                <Text style={styles.botonMapaTexto}>
                  {planificando ? 'Calculando…' : 'Organizar todos'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() =>
                onSeleccionarPedidos(
                  seleccionados.length
                    ? []
                    : planificablesVisibles.map((pedido) => pedido.id),
                )
              }
              style={styles.botonMapa}
            >
              <Text style={styles.botonMapaTexto}>
                {seleccionados.length ? 'Limpiar selección' : 'Seleccionar todos'}
              </Text>
            </Pressable>
          </View>

          {puedePlanificar ? (
            <View style={styles.fila}>
              <Pressable
                disabled={planificando}
                onPress={() => onPlanificarActual(idsSeleccionadosPlanificables)}
                style={[styles.botonMapa, planificando && styles.deshabilitado]}
              >
                <Text style={styles.botonMapaTexto}>Organizar aquí</Text>
              </Pressable>
              <Pressable
                disabled={planificando}
                onPress={() => onPlanificarDespacho(idsSeleccionadosPlanificables)}
                style={[styles.botonMapa, planificando && styles.deshabilitado]}
              >
                <Text style={styles.botonMapaTexto}>Desde ZAV</Text>
              </Pressable>
            </View>
          ) : null}

          {cantidadSeleccionadosRegistrados > 0 ? (
            <Pressable
              disabled={retirando}
              onPress={() => onRetirarSeleccionados(idsSeleccionadosRegistrados)}
              style={[styles.botonMapa, retirando && styles.deshabilitado]}
            >
              <Text style={styles.botonMapaTexto}>
                {retirando
                  ? 'Registrando retiros…'
                  : `Retirar seleccionados (${cantidadSeleccionadosRegistrados})`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {sinGpsVisibles.length ? (
        <Text style={styles.alertaInline}>
          {sinGpsVisibles.length} pedido(s) histórico(s) no pueden entrar a una ruta porque no guardaron GPS.
        </Text>
      ) : null}

      {planificacion && pedidosPlan.length ? (
        <>
          <View style={styles.tarjetaPlanControl}>
            <View style={styles.filaEntre}>
              <View style={styles.flex}>
                <Text style={styles.tarjetaTitulo}>
                  Recorrido activo · {pedidosPlan.length} parada(s)
                </Text>
                <Text style={styles.textoSecundario}>
                  {formatearDistancia(planificacion.distanciaTotalAproximadaMetros)} aprox.
                </Text>
              </View>
              <Text style={styles.estadoMiniOk}>Activo</Text>
            </View>

            <Pressable onPress={onVerMapaPlan} style={styles.mapaPreview}>
              <MapaReparto origen={planificacion.origen} paradas={planificacion.paradas} />
              <View style={styles.mapaPreviewEtiqueta}>
                <Text style={styles.botonMapaTexto}>Mapa completo</Text>
              </View>
            </Pressable>

            {nuevosParaPlan.length ? (
              <View style={styles.nuevosPedidosPlan}>
                <View style={styles.flex}>
                  <Text style={styles.nuevosPedidosTitulo}>
                    {nuevosParaPlan.length} pedido(s) fuera del recorrido
                  </Text>
                  <Text style={styles.textoSecundario}>
                    Puedes incorporarlos sin cancelar el recorrido.
                  </Text>
                </View>
                <Pressable
                  disabled={planificando}
                  onPress={() => onAgregarPedidosAlPlan(nuevosParaPlan.map((pedido) => pedido.id))}
                  style={[styles.botonMapaCompacto, planificando && styles.deshabilitado]}
                >
                  <Text style={styles.botonMapaTexto}>
                    {planificando ? 'Añadiendo…' : 'Añadir'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.fila}>
              <Pressable
                disabled={planificando}
                onPress={onActualizarUbicacionPlan}
                style={[styles.botonMapa, planificando && styles.deshabilitado]}
              >
                <Text style={styles.botonMapaTexto}>
                  {planificando ? 'Actualizando…' : 'Actualizar ubicación'}
                </Text>
              </Pressable>
              <Pressable onPress={onCancelarPlan} style={styles.botonMapa}>
                <Text style={styles.botonMapaTexto}>Finalizar organización</Text>
              </Pressable>
            </View>

            {cantidadSeleccionadosRegistrados > 0 ? (
              <Pressable
                disabled={retirando}
                onPress={() => onRetirarSeleccionados(idsSeleccionadosRegistrados)}
                style={[styles.botonMapa, retirando && styles.deshabilitado]}
              >
                <Text style={styles.botonMapaTexto}>
                  {retirando
                    ? 'Registrando retiros…'
                    : `Retirar seleccionados (${cantidadSeleccionadosRegistrados})`}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {pedidosPlan.map((pedido, indice) => tarjetaPedido(pedido, indice))}
        </>
      ) : null}

      {!planificacion && !pedidosVisibles.length ? (
        <Vacio texto={filtroPeriodo === 'HOY'
          ? 'No hay pedidos activos de hoy que coincidan con los filtros.'
          : 'No hay pedidos que coincidan con los filtros.'}
        />
      ) : null}

      {!planificacion
        ? pedidosVisibles.map((pedido) => tarjetaPedido(pedido))
        : otrosPedidos.length
          ? (
              <>
                <Text style={styles.seccionTitulo}>Otros pedidos visibles</Text>
                {otrosPedidos.map((pedido) => tarjetaPedido(pedido))}
              </>
            )
          : null}

      {pedidos.length < totalPedidos ? (
        <Pressable
          disabled={cargandoMasPedidos}
          onPress={onCargarMas}
          style={[styles.botonMapa, cargandoMasPedidos && styles.deshabilitado]}
        >
          <Text style={styles.botonMapaTexto}>
            {cargandoMasPedidos
              ? 'Cargando más pedidos…'
              : `Cargar más historial · ${pedidos.length} de ${totalPedidos}`}
          </Text>
        </Pressable>
      ) : null}
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
  onCambiarEstado,
  cambiandoEstadoId,
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
  onCambiarEstado: (cliente: Cliente) => void;
  cambiandoEstadoId: string | null;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroUbicacion, setFiltroUbicacion] = useState<'TODOS' | 'CON' | 'SIN'>('TODOS');
  const [filtroEstadoCliente, setFiltroEstadoCliente] = useState<'TODOS' | 'ACTIVOS' | 'INACTIVOS'>('ACTIVOS');
  const [orden, setOrden] = useState<'AZ' | 'ZA'>('AZ');
  const [limite, setLimite] = useState(8);

  const editando = Boolean(clienteEditando);
  const formNombre = editando ? editNombre : nombre;
  const formTelefono = editando ? editTelefono : telefono;
  const formDireccion = editando ? editDireccion : direccion;
  const formUbicacion = editando ? editUbicacion : ubicacion;

  const clientesFiltrados = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase('es-BO');
    return clientes
      .filter((cliente) => {
        const coincide =
          !consulta ||
          cliente.nombre.toLocaleLowerCase('es-BO').includes(consulta) ||
          (cliente.telefono ?? '').toLocaleLowerCase('es-BO').includes(consulta) ||
          cliente.direccion.toLocaleLowerCase('es-BO').includes(consulta);
        const coincideUbicacion =
          filtroUbicacion === 'TODOS' ||
          (filtroUbicacion === 'CON' && Boolean(cliente.ubicacion)) ||
          (filtroUbicacion === 'SIN' && !cliente.ubicacion);
        const coincideEstado =
          filtroEstadoCliente === 'TODOS' ||
          (filtroEstadoCliente === 'ACTIVOS' && cliente.activo) ||
          (filtroEstadoCliente === 'INACTIVOS' && !cliente.activo);
        return coincide && coincideUbicacion && coincideEstado;
      })
      .sort((a, b) => {
        const comparacion = a.nombre.localeCompare(b.nombre, 'es');
        return orden === 'AZ' ? comparacion : -comparacion;
      });
  }, [busqueda, clientes, filtroEstadoCliente, filtroUbicacion, orden]);

  const clientesMostrados = clientesFiltrados.slice(0, limite);
  const restantes = Math.max(0, clientesFiltrados.length - clientesMostrados.length);

  return (
    <View style={styles.bloque}>
      <Titulo
        titulo="Clientes"
        descripcion="El formulario siempre queda arriba; la lista se mantiene compacta y buscable."
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
          textoCargando={editando ? 'Guardando cambios…' : 'Guardando cliente…'}
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
        <View style={styles.filaEntre}>
          <View style={styles.flex}>
            <Text style={styles.tarjetaTitulo}>Directorio de clientes</Text>
            <Text style={styles.textoSecundario}>
              Busca antes de recorrer la lista.
            </Text>
          </View>
          <Text style={styles.estadoMiniOk}>{clientes.length}</Text>
        </View>

        <TextInput
          value={busqueda}
          onChangeText={(valor) => {
            setBusqueda(valor);
            setLimite(8);
          }}
          placeholder="Nombre, teléfono o dirección"
          placeholderTextColor="#8a8982"
          style={styles.input}
        />

        <View style={styles.filtroLinea}>
          <Text style={styles.filtroLineaTitulo}>Estado</Text>
          <View style={styles.filtrosCompactos}>
            {[
              ['ACTIVOS', 'Activos'],
              ['INACTIVOS', 'Inactivos'],
              ['TODOS', 'Todos'],
            ].map(([valor, texto]) => (
              <Pressable
                key={valor}
                onPress={() => {
                  setFiltroEstadoCliente(valor as 'TODOS' | 'ACTIVOS' | 'INACTIVOS');
                  setLimite(8);
                }}
                style={[styles.filtroChip, filtroEstadoCliente === valor && styles.filtroChipActivo]}
              >
                <Text style={[styles.filtroChipTexto, filtroEstadoCliente === valor && styles.filtroChipTextoActivo]}>
                  {texto}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.filtroLinea}>
          <Text style={styles.filtroLineaTitulo}>Ubicación</Text>
          <View style={styles.filtrosCompactos}>
            {[
              ['TODOS', 'Todos'],
              ['CON', 'Con GPS'],
              ['SIN', 'Sin GPS'],
            ].map(([valor, texto]) => (
              <Pressable
                key={valor}
                onPress={() => {
                  setFiltroUbicacion(valor as 'TODOS' | 'CON' | 'SIN');
                  setLimite(8);
                }}
                style={[styles.filtroChip, filtroUbicacion === valor && styles.filtroChipActivo]}
              >
                <Text style={[styles.filtroChipTexto, filtroUbicacion === valor && styles.filtroChipTextoActivo]}>
                  {texto}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.filtroLinea}>
          <Text style={styles.filtroLineaTitulo}>Orden</Text>
          <View style={styles.filtrosCompactos}>
            {[
              ['AZ', 'A → Z'],
              ['ZA', 'Z → A'],
            ].map(([valor, texto]) => (
              <Pressable
                key={valor}
                onPress={() => {
                  setOrden(valor as 'AZ' | 'ZA');
                  setLimite(8);
                }}
                style={[styles.filtroChip, orden === valor && styles.filtroChipActivo]}
              >
                <Text style={[styles.filtroChipTexto, orden === valor && styles.filtroChipTextoActivo]}>
                  {texto}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.contador}>
          Mostrando {clientesMostrados.length} de {clientesFiltrados.length} coincidencia(s).
        </Text>
      </View>

      {!clientesMostrados.length ? (
        <Vacio texto="No hay clientes que coincidan con los filtros." />
      ) : (
        clientesMostrados.map((cliente) => (
          <View key={cliente.id} style={styles.tarjetaCompacta}>
            <View>
              <Text style={styles.tarjetaTitulo}>{cliente.nombre}</Text>
              {cliente.telefono ? (
                <Text style={styles.textoSecundario}>{cliente.telefono}</Text>
              ) : null}
            </View>
            <View style={styles.clienteBadges}>
              <Text style={cliente.activo ? styles.estadoMiniOk : styles.estadoMiniInactivo}>
                {cliente.activo ? 'Activo' : 'Inactivo'}
              </Text>
              <Text style={cliente.ubicacion ? styles.estadoMiniOk : styles.estadoMiniPendiente}>
                {cliente.ubicacion ? 'GPS' : 'Sin GPS'}
              </Text>
            </View>
            <Text style={styles.direccion}>{cliente.direccion}</Text>
            <View style={styles.fila}>
              {cliente.activo ? (
                <Pressable
                  onPress={() => onEditar(cliente)}
                  style={[styles.botonAccionSecundario, styles.flex, styles.botonEditar]}
                >
                  <Text style={styles.botonEditarTexto}>Editar</Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={cambiandoEstadoId === cliente.id}
                onPress={() => onCambiarEstado(cliente)}
                style={[
                  styles.botonAccionSecundario,
                  styles.flex,
                  cliente.activo ? styles.botonDesactivar : styles.botonReactivar,
                  cambiandoEstadoId === cliente.id && styles.deshabilitado,
                ]}
              >
                <Text style={cliente.activo ? styles.botonAnularTexto : styles.botonReactivarTexto}>
                  {cambiandoEstadoId === cliente.id
                    ? 'Procesando…'
                    : cliente.activo
                      ? 'Desactivar'
                      : 'Reactivar'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {restantes > 0 ? (
        <Pressable onPress={() => setLimite((actual) => actual + 8)} style={styles.botonMapa}>
          <Text style={styles.botonMapaTexto}>Ver 8 más · quedan {restantes}</Text>
        </Pressable>
      ) : null}

      {limite > 8 && clientesFiltrados.length > 8 ? (
        <Pressable onPress={() => setLimite(8)} style={styles.enlaceBoton}>
          <Text style={styles.enlaceSecundario}>Mostrar menos</Text>
        </Pressable>
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
  onAbrirClientes,
  onAbrirProductos,
  onGuardar,
  editando,
  onCancelarEdicion,
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
  onAbrirClientes: () => void;
  onAbrirProductos: () => void;
  onGuardar: () => void;
  editando: boolean;
  onCancelarEdicion: () => void;
}) {
  const clienteActual =
    clientes.find((cliente) => cliente.id === clienteSeleccionado) ?? null;

  const seleccionados = productos
    .map((producto) => ({
      producto,
      cantidad: Number(cantidades[producto.productoId] ?? '0'),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.cantidad) &&
        item.cantidad > 0,
    );

  const unidades = seleccionados.reduce((acum, item) => acum + item.cantidad, 0);
  const total = seleccionados.reduce(
    (acum, item) => acum + item.cantidad * Number(item.producto.precioBob),
    0,
  );
  const sinUbicacion = clientes.filter((cliente) => !cliente.ubicacion).length;
  const productosConDisponibilidad = productos.filter(
    (producto) => producto.cantidadDisponible > 0,
  ).length;

  function quitarProducto(productoId: string) {
    setCantidades({ ...cantidades, [productoId]: '' });
  }

  return (
    <View style={styles.bloque}>
      <View style={styles.filaEntre}>
        <View style={styles.flex}>
          <Titulo
            titulo={editando ? 'Editar pedido' : 'Nuevo pedido'}
            descripcion={
              editando
                ? 'Corrige el pedido antes de retirarlo. Después del retiro se protege el historial.'
                : 'Selecciona cliente y productos mediante búsqueda. Al registrar, el formulario queda listo para el siguiente pedido.'
            }
          />
        </View>
        {editando ? (
          <Pressable onPress={onCancelarEdicion} style={styles.botonMapaCompacto}>
            <Text style={styles.botonMapaTexto}>Cancelar</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.seccionTitulo}>1. Cliente</Text>
      <View style={styles.tarjeta}>
        {clienteActual ? (
          <View style={styles.seleccionResumen}>
            <View style={styles.filaEntre}>
              <View style={styles.flex}>
                <Text style={styles.seleccionEtiqueta}>CLIENTE SELECCIONADO</Text>
                <Text style={styles.tarjetaTitulo}>{clienteActual.nombre}</Text>
                {clienteActual.telefono ? (
                  <Text style={styles.textoSecundario}>{clienteActual.telefono}</Text>
                ) : null}
                <Text style={styles.direccion}>{clienteActual.direccion}</Text>
              </View>
              <Text style={styles.estadoMiniOk}>GPS</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.textoSecundario}>
            Ningún cliente seleccionado.
          </Text>
        )}

        <View style={styles.fila}>
          <Pressable onPress={onAbrirClientes} style={styles.botonMapa}>
            <Text style={styles.botonMapaTexto}>
              {clienteActual ? 'Cambiar cliente' : 'Buscar y seleccionar cliente'}
            </Text>
          </Pressable>
          {clienteActual ? (
            <Pressable
              onPress={() => setClienteSeleccionado('')}
              style={styles.botonMapaCompacto}
            >
              <Text style={styles.botonMapaTexto}>Quitar</Text>
            </Pressable>
          ) : null}
        </View>

        {sinUbicacion ? (
          <Text style={styles.textoSecundario}>
            {sinUbicacion} cliente(s) sin GPS se excluyen del selector de pedidos.
          </Text>
        ) : null}
      </View>

      <Text style={styles.seccionTitulo}>2. Productos</Text>
      <View style={styles.tarjeta}>
        <View style={styles.filaEntre}>
          <View style={styles.flex}>
            <Text style={styles.tarjetaTitulo}>Detalle del pedido</Text>
            <Text style={styles.textoSecundario}>
              {seleccionados.length} producto(s) · {unidades} unidad(es)
            </Text>
          </View>
          {seleccionados.length ? (
            <Text style={styles.estadoMiniOk}>Bs {total.toFixed(2)}</Text>
          ) : null}
        </View>

        <Pressable onPress={onAbrirProductos} style={styles.botonMapa}>
          <Text style={styles.botonMapaTexto}>
            {seleccionados.length ? 'Agregar o cambiar productos' : 'Buscar y agregar productos'}
          </Text>
        </Pressable>

        {!productos.length ? (
          <Text style={styles.alertaInline}>
            No se cargó ningún producto activo. Actualiza la pantalla; si el aviso persiste, la disponibilidad del backend requiere revisión.
          </Text>
        ) : productosConDisponibilidad === 0 ? (
          <Text style={styles.alertaInline}>
            Hay {productos.length} producto(s) activos, pero ninguno tiene stock disponible en Venta y Despacho.
          </Text>
        ) : (
          <Text style={styles.textoSecundario}>
            {productosConDisponibilidad} de {productos.length} producto(s) con stock disponible.
          </Text>
        )}

        {!seleccionados.length ? (
          <Text style={styles.textoSecundario}>
            Todavía no agregaste productos.
          </Text>
        ) : (
          seleccionados.map(({ producto, cantidad }) => (
            <View key={producto.productoId} style={styles.productoSeleccionado}>
              <View style={styles.flex}>
                <Text style={styles.tarjetaTitulo}>{producto.nombre}</Text>
                <Text style={styles.textoSecundario}>
                  {producto.codigo} · {producto.presentacion}
                </Text>
                <Text style={styles.disponible}>
                  {cantidad} unidad(es) · disponible ahora: {producto.cantidadDisponible}
                </Text>
              </View>
              <View style={styles.productoSeleccionadoAcciones}>
                <Text style={styles.productoCantidad}>{cantidad}</Text>
                <Pressable
                  onPress={() => quitarProducto(producto.productoId)}
                  style={styles.quitarProducto}
                >
                  <Text style={styles.quitarProductoTexto}>Quitar</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Text style={styles.textoSecundario}>
          Los lotes concretos se asignan automáticamente al retirar el pedido según disponibilidad y vencimiento; aquí se registran productos y cantidades.
        </Text>
      </View>

      <Text style={styles.seccionTitulo}>3. Observación</Text>
      <Campo
        label="Opcional"
        value={observacion}
        onChangeText={setObservacion}
        multiline
      />

      <BotonAccion
        texto={editando ? 'Guardar corrección' : 'Registrar pedido'}
        textoCargando={editando ? 'Guardando corrección…' : 'Registrando y actualizando stock…'}
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
  textoCargando = 'Procesando…',
  cargando,
  onPress,
  variante = 'normal',
}: {
  texto: string;
  textoCargando?: string;
  cargando: boolean;
  onPress: () => void;
  variante?: 'normal' | 'entrega';
}) {
  return (
    <Pressable
      disabled={cargando}
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        variante === 'entrega' && styles.botonEntrega,
        pressed && !cargando && styles.botonPresionado,
        cargando && styles.deshabilitado,
      ]}
    >
      {cargando ? (
        <View style={styles.botonCargandoFila}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.botonTexto}>{textoCargando}</Text>
        </View>
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
        estado === 'CANCELADO' && styles.estadoCancelado,
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
  contenido: { padding: 14, paddingBottom: 72 },
  bloque: { gap: 10 },
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
    borderRadius: 10,
    padding: 13,
    gap: 10,
  },
  tarjetaCompacta: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddddd5',
    borderRadius: 9,
    padding: 12,
    gap: 7,
  },
  tarjetaPlan: {
    borderColor: '#d9a28f',
    backgroundColor: '#fffaf7',
  },
  tarjetaPorRetirar: {
    borderLeftWidth: 4,
    borderLeftColor: '#c98a18',
    backgroundColor: '#fffdf7',
  },
  tarjetaParaEntregar: {
    borderLeftWidth: 4,
    borderLeftColor: '#2d7a55',
    backgroundColor: '#f8fcfa',
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
  nuevosPedidosPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f3f6f8',
    borderWidth: 1,
    borderColor: '#d7dfe4',
    borderRadius: 8,
    padding: 10,
  },
  nuevosPedidosTitulo: {
    color: '#38464f',
    fontSize: 12,
    fontWeight: '800',
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
    minHeight: 42,
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
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '800',
  },
  botonSeleccionTextoActivo: {
    color: '#b83b17',
  },
  botonOrdenAncho: {
    flex: 1,
    minHeight: 42,
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
  resumenPedido: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    justifyContent: 'space-between',
  },
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
  estadoCancelado: { backgroundColor: '#f1efed' },
  estadoTexto: { color: '#50504a', fontSize: 10, fontWeight: '800' },
  boton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#b83b17',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  botonPresionado: { backgroundColor: '#963011' },
  botonEntrega: { backgroundColor: '#2d7a55' },
  botonTexto: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  botonCargandoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
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
  filtrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filtroChipMitad: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
  },
  filtroChipTercio: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
  },
  filtroChip: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    backgroundColor: '#fff',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
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
  seleccionResumen: {
    borderWidth: 1,
    borderColor: '#c9dfd0',
    backgroundColor: '#eef7f1',
    borderRadius: 8,
    padding: 11,
    gap: 4,
  },
  seleccionEtiqueta: {
    color: '#286344',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  productoSeleccionado: {
    borderTopWidth: 1,
    borderTopColor: '#eeeeea',
    paddingTop: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  productoSeleccionadoAcciones: {
    alignItems: 'flex-end',
    gap: 5,
  },
  productoCantidad: {
    minWidth: 34,
    textAlign: 'center',
    color: '#262622',
    fontSize: 18,
    fontWeight: '900',
  },
  quitarProducto: {
    borderWidth: 1,
    borderColor: '#d8b3a7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  quitarProductoTexto: {
    color: '#9b3215',
    fontSize: 10,
    fontWeight: '800',
  },
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
  notificacionZona: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 100,
    elevation: 24,
  },
  notificacion: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificacionError: {
    backgroundColor: '#fff8f5',
    borderColor: '#e4b9ac',
  },
  notificacionExito: {
    backgroundColor: '#f4faf6',
    borderColor: '#b8d7c2',
  },
  notificacionIcono: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificacionIconoError: { backgroundColor: '#a9472b' },
  notificacionIconoExito: { backgroundColor: '#2d7a55' },
  notificacionIconoTexto: { color: '#fff', fontSize: 15, fontWeight: '900' },
  notificacionTitulo: { fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  notificacionTituloError: { color: '#89361f' },
  notificacionTituloExito: { color: '#286344' },
  notificacionMensaje: {
    color: '#50504a',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  notificacionCerrar: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificacionCerrarTexto: { color: '#66665e', fontSize: 22, lineHeight: 24, fontWeight: '700' },
  accionesPedido: { gap: 8 },
  botonMapa: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#b83b17',
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    flex: 1,
  },
  botonMapaTexto: {
    color: '#b83b17',
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  botonMapaCompacto: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#b83b17',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fila: { flexDirection: 'row', gap: 8 },
  filaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  botonAccionSecundario: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonAccionSecundarioTexto: {
    color: '#50504a',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '800',
  },
  botonEditar: { borderColor: '#d59b87' },
  botonEditarTexto: {
    color: '#9b3215',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '800',
  },
  botonDesactivar: { borderColor: '#dfb4ad' },
  botonReactivar: { borderColor: '#b8d7c2' },
  botonAnularTexto: {
    color: '#a1322c',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '800',
  },
  botonReactivarTexto: {
    color: '#286344',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '800',
  },
  accionPendiente: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  accionPendienteRetiro: { color: '#8a5a08', backgroundColor: '#fff4cf' },
  accionPendienteEntrega: { color: '#286344', backgroundColor: '#eaf4ed' },
  botonHistorial: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonHistorialTexto: {
    color: '#50504a',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '800',
  },
  clienteBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  filtroLinea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filtroLineaTitulo: {
    width: 62,
    color: '#66665e',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filtrosCompactos: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  estadoMiniInactivo: {
    color: '#6f625d',
    backgroundColor: '#f1efed',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '800',
  },
  enlaceBoton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

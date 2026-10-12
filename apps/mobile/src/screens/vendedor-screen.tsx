import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
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
import { styles } from './vendedor-estilos';
import { Pedidos } from '@/components/vendedor-pedidos';
import { Clientes, NuevoPedido } from '@/components/vendedor-formularios';
import { distanciaMetros, formatearDistancia, recalcularSecuencia } from '@/lib/distribucion';
import { MapaRepartoModal, SelectorUbicacionMapa } from '@/components/mapas-distribucion';
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
    const codigo = error.status > 0 ? `HTTP ${error.status}` : 'SIN RESPUESTA HTTP';
    const mensaje = error.message.toLocaleLowerCase('es-BO');
    if (
      error.status === 400 &&
      (mensaje.includes('estado de pedido no valido') ||
        mensaje.includes('campos no permitidos'))
    ) {
      return `${codigo} · La API de desarrollo no está alineada con esta versión de la aplicación. Actualiza los datos e inténtalo nuevamente.`;
    }
    if (error.status === 404 && error.body?.path?.includes('/estado')) {
      return `${codigo} · La gestión de estado de clientes todavía no está disponible en la API conectada.`;
    }
    return `${codigo} · ${error.message}`;
  }
  return 'ERROR LOCAL · Ocurrió un error inesperado.';
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
        Alert.alert('Sesión no válida', `HTTP ${e.status} · Vuelve a iniciar sesión para continuar.`);
        await onCerrarSesion();
        return;
      }
      setError(mensajeError(e));
    },
    [onCerrarSesion],
  );

  const confirmarCerrarSesion = useCallback(() => {
    Alert.alert(
      'Cerrar sesión',
      '¿Confirmas que deseas cerrar tu sesión de Vendedor en este dispositivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: () => void onCerrarSesion() },
      ],
    );
  }, [onCerrarSesion]);

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
          setError(`ERROR DE CARGA · No se pudo actualizar ${detalle}`);
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
        setError(`ERROR DE CARGA · No se pudo actualizar ${detalle}`);
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
      setError('VALIDACIÓN · El nombre del cliente es obligatorio.');
      return;
    }
    if (!clienteUbicacion || !clienteDireccion.trim()) {
      setError('VALIDACIÓN · Define y confirma la ubicación del cliente en el mapa.');
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
      setError('VALIDACIÓN · El nombre del cliente es obligatorio.');
      return;
    }
    if (!clienteEditUbicacion || !clienteEditDireccion.trim()) {
      setError('VALIDACIÓN · El cliente debe tener una ubicación confirmada en Tarija.');
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
      setError('VALIDACIÓN · Selecciona un cliente.');
      return;
    }

    const clienteActual = clientes.find((cliente) => cliente.id === clienteSeleccionado);
    if (!clienteActual?.activo || !clienteActual.ubicacion) {
      setError('VALIDACIÓN · El cliente seleccionado debe estar activo y tener ubicación confirmada.');
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
      setError('VALIDACIÓN · Indica al menos una cantidad de producto.');
      return;
    }

    const invalido = detalles.find((detalle) => {
      const producto = productosFormulario.find((p) => p.productoId === detalle.productoId);
      return !producto || detalle.cantidad > producto.cantidadDisponible;
    });
    if (invalido) {
      setError('VALIDACIÓN · Una de las cantidades supera la disponibilidad permitida.');
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
      setError('VALIDACIÓN · Solo se pueden corregir pedidos que todavía no fueron retirados.');
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
            `HTTP ${errorCancelados.status} · Los pedidos entregados están disponibles, pero la consulta de anulados no está disponible en esta versión del backend.`,
          );
        } else {
          setHistorialMensaje(
            `${mensajeError(errorCancelados)} · Los pedidos entregados están disponibles, pero no fue posible consultar los anulados.`,
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
      setError('VALIDACIÓN · Este pedido no tiene un destino georreferenciado.');
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
        setError('ERROR LOCAL · Activa la ubicación del teléfono y vuelve a intentar la entrega.');
        return;
      }

      const permiso = await Location.requestForegroundPermissionsAsync();
      if (permiso.status !== 'granted') {
        setError('ERROR LOCAL · La entrega no se registró porque no se autorizó la ubicación puntual.');
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
      setError('VALIDACIÓN · Se necesitan al menos dos pedidos pendientes con ubicación confirmada.');
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
      setError('VALIDACIÓN · Selecciona al menos dos pedidos georreferenciados para planificar.');
      return;
    }

    setPlanificando(true);
    setError('');
    try {
      if (origen === 'DESPACHO') {
        const nueva = await planificarReparto(token, {
          pedidoIds,
          origenTipo: 'DESPACHO',
        });
        setPlanificacion(nueva);
        setAviso(`Recorrido organizado desde Venta y Despacho con ${nueva.paradas.length} parada(s).`);
        return;
      }

      const permiso = await Location.requestForegroundPermissionsAsync();
      if (permiso.status !== 'granted') {
        setError('ERROR LOCAL · Se necesita permiso de ubicación para usar tu posición como origen.');
        return;
      }
      const posicion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const nueva = await planificarReparto(token, {
        pedidoIds,
        origenTipo: 'ACTUAL',
        origenLatitud: posicion.coords.latitude,
        origenLongitud: posicion.coords.longitude,
      });
      setPlanificacion(nueva);
      setAviso(`Recorrido organizado desde tu ubicación actual con ${nueva.paradas.length} parada(s).`);
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
        setError('ERROR LOCAL · Se necesita permiso de ubicación para actualizar el recorrido.');
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
        setAviso('Recorrido actualizado desde tu ubicación actual.');
        return;
      }

      const actualizada = await planificarReparto(token, {
        pedidoIds: planificacion.paradas.map((parada) => parada.pedidoId),
        origenTipo: 'ACTUAL',
        origenLatitud: origen.latitud,
        origenLongitud: origen.longitud,
      });
      setPlanificacion(actualizada);
      setAviso('Recorrido recalculado correctamente desde tu ubicación actual.');
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
        setError('ERROR LOCAL · Se necesita permiso de ubicación para recalcular el recorrido.');
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
      setError('VALIDACIÓN · Los pedidos seleccionados ya están en distribución o fueron entregados.');
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
      setError('VALIDACIÓN · Selecciona al menos un pedido registrado.');
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
        <Pressable onPress={confirmarCerrarSesion} style={styles.botonSecundarioCompacto}>
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
  const coincidenciaCodigo = esError ? mensaje.match(/^(HTTP \d{3}|SIN RESPUESTA HTTP|VALIDACIÓN|ERROR LOCAL|ERROR DE CARGA|SIN RESULTADOS|ROL NO PERMITIDO) · (.+)$/s) : null;
  const codigo = coincidenciaCodigo?.[1] ?? null;
  const mensajeVisible = coincidenciaCodigo?.[2] ?? mensaje;
  const [progreso] = useState(() => new Animated.Value(0));
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
          {codigo ? <Text style={styles.notificacionCodigo}>{codigo}</Text> : null}
          <Text style={styles.notificacionMensaje}>{mensajeVisible}</Text>
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



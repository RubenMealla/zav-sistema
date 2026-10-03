import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  crearCliente,
  crearPedido,
  entregarPedido,
  listarClientes,
  listarPedidos,
  obtenerDisponibilidad,
  retirarPedido,
} from '@/lib/api';
import type {
  Cliente,
  Disponibilidad,
  PedidoResumen,
  Sesion,
} from '@/lib/tipos';
import { uuidV4 } from '@/lib/uuid';

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
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  const [clienteSeleccionado, setClienteSeleccionado] = useState('');
  const [observacion, setObservacion] = useState('');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [accionPedido, setAccionPedido] = useState<string | null>(null);

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
    if (!clienteNombre.trim() || !clienteDireccion.trim()) {
      setError('Nombre y dirección son obligatorios.');
      return;
    }

    setGuardandoCliente(true);
    setError('');
    try {
      const cliente = await crearCliente(token, {
        nombre: clienteNombre.trim(),
        telefono: clienteTelefono.trim() || undefined,
        direccion: clienteDireccion.trim(),
      });
      setClientes((actuales) =>
        [...actuales, cliente].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      setClienteNombre('');
      setClienteTelefono('');
      setClienteDireccion('');
      Alert.alert('Cliente registrado', 'El cliente ya está disponible para pedidos.');
    } catch (e) {
      await manejarError(e);
    } finally {
      setGuardandoCliente(false);
    }
  }

  async function guardarPedido() {
    if (!clienteSeleccionado) {
      setError('Selecciona un cliente.');
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
      'Confirmar retiro',
      `¿Registrar el retiro del pedido de ${pedido.cliente.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Retirar',
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
      Alert.alert('Retiro registrado', 'El pedido pasó a En distribución.');
    } catch (e) {
      await manejarError(e);
    } finally {
      setAccionPedido(null);
    }
  }

  async function entregar(pedido: PedidoResumen) {
    Alert.alert(
      'Confirmar entrega',
      'Se solicitará la ubicación del dispositivo una sola vez para registrar esta entrega.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => {
            void ejecutarEntrega(pedido.id);
          },
        },
      ],
    );
  }

  async function ejecutarEntrega(id: string) {
    setAccionPedido(id);
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

      await entregarPedido(token, id, {
        operacionClave: uuidV4(),
        latitud: posicion.coords.latitude,
        longitud: posicion.coords.longitude,
      });

      await cargar(false);
      Alert.alert('Entrega registrada', 'Se guardó la ubicación puntual de la entrega.');
    } catch (e) {
      await manejarError(e);
    } finally {
      setAccionPedido(null);
    }
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
          <Pedidos
            pedidos={pedidos}
            accionPedido={accionPedido}
            onRetirar={retirar}
            onEntregar={entregar}
          />
        ) : null}

        {seccion === 'clientes' ? (
          <Clientes
            clientes={clientes}
            nombre={clienteNombre}
            telefono={clienteTelefono}
            direccion={clienteDireccion}
            guardando={guardandoCliente}
            setNombre={setClienteNombre}
            setTelefono={setClienteTelefono}
            setDireccion={setClienteDireccion}
            onGuardar={guardarCliente}
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
}: {
  pedidos: PedidoResumen[];
  accionPedido: string | null;
  onRetirar: (pedido: PedidoResumen) => void;
  onEntregar: (pedido: PedidoResumen) => void;
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
                texto="Registrar retiro"
                cargando={accionPedido === pedido.id}
                onPress={() => onRetirar(pedido)}
              />
            ) : null}

            {pedido.estado === 'EN_DISTRIBUCION' ? (
              <BotonAccion
                texto="Confirmar entrega con GPS"
                cargando={accionPedido === pedido.id}
                onPress={() => onEntregar(pedido)}
              />
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
  guardando,
  setNombre,
  setTelefono,
  setDireccion,
  onGuardar,
}: {
  clientes: Cliente[];
  nombre: string;
  telefono: string;
  direccion: string;
  guardando: boolean;
  setNombre: (v: string) => void;
  setTelefono: (v: string) => void;
  setDireccion: (v: string) => void;
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
        </View>
      ))}
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
  contenido: { padding: 16, paddingBottom: 40 },
  bloque: { gap: 12 },
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
});

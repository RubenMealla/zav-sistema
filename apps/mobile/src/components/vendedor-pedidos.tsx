import { Pressable, Text, TextInput, View } from 'react-native';
import type { PedidoResumen, PlanificacionReparto } from '@/lib/tipos';
import { fechaCorta, formatearDistancia } from '@/lib/distribucion';
import { MapaReparto } from '@/components/mapas-distribucion';
import { BotonAccion, Dato, Estado, Titulo, Vacio, estadoLegible } from './vendedor-ui';
import { styles } from '@/screens/vendedor-estilos';

export function Pedidos({
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

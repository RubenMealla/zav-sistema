import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Cliente, Disponibilidad, PuntoGeografico } from '@/lib/tipos';
import { BotonAccion, Campo, Titulo, Vacio } from './vendedor-ui';
import { styles } from '@/screens/vendedor-estilos';

export function Clientes({
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


export function NuevoPedido({
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

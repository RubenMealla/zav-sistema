import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Cliente, Disponibilidad } from '@/lib/tipos';

function normalizar(texto: string) {
  return texto.trim().toLocaleLowerCase('es-BO');
}

function cantidadNumerica(valor: string | undefined) {
  const numero = Number(valor ?? '0');
  return Number.isInteger(numero) && numero > 0 ? numero : 0;
}

export function SelectorClientePedidoModal({
  visible,
  clientes,
  seleccionadoId,
  onCerrar,
  onSeleccionar,
}: {
  visible: boolean;
  clientes: Cliente[];
  seleccionadoId: string;
  onCerrar: () => void;
  onSeleccionar: (clienteId: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const disponibles = useMemo(
    () => clientes.filter((cliente) => cliente.activo && Boolean(cliente.ubicacion)),
    [clientes],
  );

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return disponibles
      .filter(
        (cliente) =>
          !q ||
          normalizar(cliente.nombre).includes(q) ||
          normalizar(cliente.direccion).includes(q) ||
          normalizar(cliente.telefono ?? '').includes(q),
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [busqueda, disponibles]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
        <View style={styles.cabecera}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>NUEVO PEDIDO</Text>
            <Text style={styles.titulo}>Seleccionar cliente</Text>
            <Text style={styles.subtitulo}>
              Busca por nombre, teléfono o dirección.
            </Text>
          </View>
          <Pressable onPress={onCerrar} style={styles.botonCerrar}>
            <Text style={styles.botonCerrarTexto}>Cerrar</Text>
          </Pressable>
        </View>

        <View style={styles.busqueda}>
          <TextInput
            autoFocus
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar cliente"
            placeholderTextColor="#8a8982"
            style={styles.input}
            returnKeyType="search"
          />
          <Text style={styles.contador}>
            {filtrados.length} cliente(s) con ubicación confirmada
          </Text>
        </View>

        <FlatList
          data={filtrados}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.lista}
          initialNumToRender={12}
          windowSize={7}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text style={styles.subtitulo}>No hay clientes que coincidan.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const activo = item.id === seleccionadoId;
            return (
              <Pressable
                onPress={() => {
                  setBusqueda('');
                  onSeleccionar(item.id);
                }}
                style={[styles.item, activo && styles.itemActivo]}
              >
                <View style={styles.filaEntre}>
                  <View style={styles.flex}>
                    <Text style={[styles.itemTitulo, activo && styles.itemTituloActivo]}>
                      {item.nombre}
                    </Text>
                    {item.telefono ? (
                      <Text style={styles.itemMeta}>{item.telefono}</Text>
                    ) : null}
                    <Text style={styles.itemDireccion}>{item.direccion}</Text>
                  </View>
                  <View style={[styles.estado, activo && styles.estadoActivo]}>
                    <Text style={[styles.estadoTexto, activo && styles.estadoTextoActivo]}>
                      {activo ? '✓' : 'Elegir'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

export function SelectorProductosPedidoModal({
  visible,
  productos,
  cantidades,
  onCerrar,
  onCambiarCantidad,
}: {
  visible: boolean;
  productos: Disponibilidad[];
  cantidades: Record<string, string>;
  onCerrar: () => void;
  onCambiarCantidad: (productoId: string, cantidad: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return productos
      .filter(
        (producto) =>
          !q ||
          normalizar(producto.nombre).includes(q) ||
          normalizar(producto.codigo).includes(q) ||
          normalizar(producto.familia).includes(q) ||
          normalizar(producto.presentacion).includes(q),
      )
      .sort((a, b) => {
        const aSeleccionado = cantidadNumerica(cantidades[a.productoId]) > 0 ? 0 : 1;
        const bSeleccionado = cantidadNumerica(cantidades[b.productoId]) > 0 ? 0 : 1;
        const aDisponible = a.cantidadDisponible > 0 ? 0 : 1;
        const bDisponible = b.cantidadDisponible > 0 ? 0 : 1;
        return (
          aSeleccionado - bSeleccionado ||
          aDisponible - bDisponible ||
          a.nombre.localeCompare(b.nombre, 'es')
        );
      });
  }, [busqueda, cantidades, productos]);

  const disponibles = useMemo(
    () => productos.filter((producto) => producto.cantidadDisponible > 0).length,
    [productos],
  );

  const resumen = useMemo(() => {
    let productosSeleccionados = 0;
    let unidades = 0;
    for (const producto of productos) {
      const cantidad = cantidadNumerica(cantidades[producto.productoId]);
      if (cantidad > 0) {
        productosSeleccionados += 1;
        unidades += cantidad;
      }
    }
    return { productosSeleccionados, unidades };
  }, [cantidades, productos]);

  function cambiar(producto: Disponibilidad, valor: string) {
    const limpio = valor.replace(/\D/g, '');
    if (!limpio) {
      onCambiarCantidad(producto.productoId, '');
      return;
    }
    const limitado = Math.min(Number(limpio), producto.cantidadDisponible);
    onCambiarCantidad(producto.productoId, String(limitado));
  }

  function sumar(producto: Disponibilidad, delta: -1 | 1) {
    const actual = cantidadNumerica(cantidades[producto.productoId]);
    const siguiente = Math.max(
      0,
      Math.min(producto.cantidadDisponible, actual + delta),
    );
    onCambiarCantidad(
      producto.productoId,
      siguiente === 0 ? '' : String(siguiente),
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
        <View style={styles.cabecera}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>NUEVO PEDIDO</Text>
            <Text style={styles.titulo}>Agregar productos</Text>
            <Text style={styles.subtitulo}>
              Busca y define cantidades sin recorrer todo el catálogo.
            </Text>
          </View>
          <Pressable onPress={onCerrar} style={styles.botonCerrar}>
            <Text style={styles.botonCerrarTexto}>Cerrar</Text>
          </Pressable>
        </View>

        <View style={styles.busqueda}>
          <TextInput
            autoFocus
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Nombre, código, familia o presentación"
            placeholderTextColor="#8a8982"
            style={styles.input}
            returnKeyType="search"
          />
          <Text style={styles.contador}>
            {filtrados.length} producto(s) · {disponibles} con stock
          </Text>
        </View>

        <FlatList
          data={filtrados}
          keyExtractor={(item) => item.productoId}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listaConPie}
          initialNumToRender={12}
          windowSize={7}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text style={styles.subtitulo}>
                No hay productos activos que coincidan.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const cantidad = cantidades[item.productoId] ?? '';
            const seleccionada = cantidadNumerica(cantidad) > 0;
            const sinStock = item.cantidadDisponible <= 0;
            return (
              <View
                style={[
                  styles.item,
                  seleccionada && styles.itemActivo,
                  sinStock && styles.itemSinStock,
                ]}
              >
                <View style={styles.filaEntre}>
                  <View style={styles.flex}>
                    <Text
                      style={[
                        styles.itemTitulo,
                        seleccionada && styles.itemTituloActivo,
                      ]}
                    >
                      {item.nombre}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {item.codigo} · {item.presentacion} · Bs {item.precioBob}
                    </Text>
                    <Text style={sinStock ? styles.stockAgotado : styles.stock}>
                      {sinStock
                        ? 'Sin stock disponible en Venta y Despacho'
                        : `Disponible: ${item.cantidadDisponible}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.cantidadFila}>
                  <Pressable
                    accessibilityLabel={`Restar una unidad de ${item.nombre}`}
                    disabled={sinStock}
                    onPress={() => sumar(item, -1)}
                    style={[styles.cantidadBoton, sinStock && styles.deshabilitado]}
                  >
                    <Text style={styles.cantidadBotonTexto}>−</Text>
                  </Pressable>
                  <TextInput
                    accessibilityLabel={`Cantidad de ${item.nombre}`}
                    keyboardType="number-pad"
                    value={cantidad}
                    editable={!sinStock}
                    onChangeText={(valor) => cambiar(item, valor)}
                    placeholder="0"
                    placeholderTextColor="#8a8982"
                    style={styles.cantidadInput}
                    selectTextOnFocus
                  />
                  <Pressable
                    accessibilityLabel={`Sumar una unidad de ${item.nombre}`}
                    disabled={sinStock}
                    onPress={() => sumar(item, 1)}
                    style={[styles.cantidadBoton, sinStock && styles.deshabilitado]}
                  >
                    <Text style={styles.cantidadBotonTexto}>+</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.pie}>
          <View style={styles.flex}>
            <Text style={styles.pieTitulo}>
              {resumen.productosSeleccionados} producto(s)
            </Text>
            <Text style={styles.subtitulo}>{resumen.unidades} unidad(es)</Text>
          </View>
          <Pressable
            onPress={() => {
              setBusqueda('');
              onCerrar();
            }}
            style={styles.botonListo}
          >
            <Text style={styles.botonListoTexto}>Listo</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#f6f5f0' },
  cabecera: {
    backgroundColor: '#20201e',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  flex: { flex: 1 },
  eyebrow: {
    color: '#f2a488',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  titulo: { color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 3 },
  subtitulo: { color: '#717169', fontSize: 12, lineHeight: 17 },
  botonCerrar: {
    borderWidth: 1,
    borderColor: '#66665e',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  botonCerrarTexto: { color: '#fff', fontSize: 12, fontWeight: '800' },
  busqueda: {
    backgroundColor: '#fff',
    padding: 14,
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#ddddd5',
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    color: '#262622',
    fontSize: 15,
  },
  contador: { color: '#717169', fontSize: 11 },
  lista: { padding: 14, gap: 8, paddingBottom: 32 },
  listaConPie: { padding: 14, gap: 8, paddingBottom: 24 },
  item: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddddd5',
    borderRadius: 9,
    padding: 13,
    gap: 10,
  },
  itemActivo: { borderColor: '#b83b17', backgroundColor: '#fff8f4' },
  itemSinStock: { backgroundColor: '#f5f4f1', opacity: 0.82 },
  filaEntre: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  itemTitulo: { color: '#262622', fontSize: 15, fontWeight: '800' },
  itemTituloActivo: { color: '#9b3215' },
  itemMeta: { color: '#717169', fontSize: 11, lineHeight: 16, marginTop: 3 },
  itemDireccion: { color: '#50504a', fontSize: 12, lineHeight: 17, marginTop: 4 },
  stock: { color: '#286344', fontSize: 11, fontWeight: '800', marginTop: 4 },
  stockAgotado: { color: '#7a6d68', fontSize: 11, fontWeight: '800', marginTop: 4 },
  estado: {
    borderWidth: 1,
    borderColor: '#c6c5bd',
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  estadoActivo: { borderColor: '#b83b17', backgroundColor: '#fdf0e9' },
  estadoTexto: { color: '#66665e', fontSize: 10, fontWeight: '800' },
  estadoTextoActivo: { color: '#b83b17' },
  cantidadFila: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end' },
  deshabilitado: { opacity: 0.45 },
  cantidadBoton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  cantidadBotonTexto: { color: '#b83b17', fontSize: 22, fontWeight: '800' },
  cantidadInput: {
    width: 66,
    height: 42,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#c6c5bd',
    textAlign: 'center',
    backgroundColor: '#fff',
    color: '#262622',
    fontSize: 16,
    fontWeight: '800',
  },
  vacio: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#c6c5bd',
    borderRadius: 9,
    padding: 18,
    backgroundColor: '#fff',
  },
  pie: {
    borderTopWidth: 1,
    borderTopColor: '#ddddd5',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  pieTitulo: { color: '#262622', fontSize: 14, fontWeight: '900' },
  botonListo: {
    minWidth: 96,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#b83b17',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  botonListoTexto: { color: '#fff', fontSize: 13, fontWeight: '900' },
});

import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import type { PedidoResumen } from '@/lib/tipos';
import { styles } from '@/screens/vendedor-estilos';

export function estadoLegible(estado: PedidoResumen['estado']) {
  if (estado === 'REGISTRADO') return 'Por retirar';
  if (estado === 'EN_DISTRIBUCION') return 'Para entregar';
  if (estado === 'CANCELADO') return 'Anulado';
  return 'Entregado';
}

export function Titulo({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <View style={styles.tituloBloque}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.descripcion}>{descripcion}</Text>
    </View>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return (
    <View style={styles.vacio}>
      <Text style={styles.textoSecundario}>{texto}</Text>
    </View>
  );
}

export function Campo({
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

export function BotonAccion({
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


export function Estado({ estado }: { estado: PedidoResumen['estado'] }) {
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

export function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text style={styles.datoValor}>{valor}</Text>
    </View>
  );
}

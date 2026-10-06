import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError, iniciarSesion } from '@/lib/api';
import type { Sesion } from '@/lib/tipos';

type Props = {
  onSesion: (sesion: Sesion) => Promise<void>;
};

function separarError(mensaje: string) {
  const coincidencia = mensaje.match(/^(HTTP \d{3}|SIN RESPUESTA HTTP|VALIDACIÓN|ERROR LOCAL|ROL NO PERMITIDO) · (.+)$/s);
  return {
    codigo: coincidencia?.[1] ?? null,
    mensaje: coincidencia?.[2] ?? mensaje,
  };
}

export function LoginScreen({ onSesion }: Props) {
  const [identificador, setIdentificador] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function ingresar() {
    const usuario = identificador.trim().toLowerCase();
    if (!usuario || !contrasena) {
      setError('VALIDACIÓN · Ingresa tu identificador y contraseña.');
      return;
    }

    setEnviando(true);
    setError('');
    try {
      const sesion = await iniciarSesion(usuario, contrasena);
      if (sesion.usuario.rol !== 'VENDEDOR') {
        setError('ROL NO PERMITIDO · Esta aplicación es exclusiva para el rol Vendedor.');
        return;
      }
      await onSesion(sesion);
    } catch (e) {
      if (e instanceof ApiError) {
        const codigo = e.status > 0 ? `HTTP ${e.status}` : 'SIN RESPUESTA HTTP';
        setError(`${codigo} · ${e.message}`);
      } else {
        setError('ERROR LOCAL · No se pudo iniciar sesión.');
      }
    } finally {
      setEnviando(false);
    }
  }

  const errorVisible = separarError(error);

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.marca}>
        <Text style={styles.eyebrow}>ZAV · DISTRIBUCIÓN</Text>
        <Text style={styles.titulo}>Acceso del Vendedor</Text>
        <Text style={styles.descripcion}>
          Registra clientes, pedidos, retiros y entregas desde el teléfono.
        </Text>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.label}>Identificador</Text>
        <TextInput
          accessibilityLabel="Identificador"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="vendedor@zav.test"
          placeholderTextColor="#8a8982"
          style={styles.input}
          value={identificador}
          onChangeText={setIdentificador}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          accessibilityLabel="Contraseña"
          autoCapitalize="none"
          placeholder="••••••••"
          placeholderTextColor="#8a8982"
          secureTextEntry
          style={styles.input}
          value={contrasena}
          onChangeText={setContrasena}
          onSubmitEditing={ingresar}
        />

        {error ? (
          <View style={styles.error}>
            {errorVisible.codigo ? <Text style={styles.errorCodigo}>{errorVisible.codigo}</Text> : null}
            <Text style={styles.errorMensaje}>{errorVisible.mensaje}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={enviando}
          onPress={ingresar}
          style={({ pressed }) => [
            styles.boton,
            pressed && styles.botonPresionado,
            enviando && styles.deshabilitado,
          ]}
        >
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonTexto}>Iniciar sesión</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.pie}>
        Uso interno · El token de sesión se almacena de forma cifrada en el dispositivo.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: '#f6f5f0',
    paddingHorizontal: 22,
    justifyContent: 'center',
    gap: 22,
  },
  marca: { gap: 8 },
  eyebrow: {
    color: '#b83b17',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  titulo: {
    color: '#20201e',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  descripcion: {
    color: '#66665e',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 360,
  },
  tarjeta: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddddd5',
    borderRadius: 10,
    padding: 18,
    gap: 9,
  },
  label: {
    color: '#50504a',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#c6c5bd',
    borderRadius: 7,
    paddingHorizontal: 14,
    color: '#262622',
    backgroundColor: '#fff',
    fontSize: 16,
  },
  error: {
    backgroundColor: '#fcefeb',
    borderRadius: 6,
    padding: 10,
    gap: 3,
  },
  errorCodigo: {
    color: '#8b2f25',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  errorMensaje: {
    color: '#a1322c',
    lineHeight: 19,
  },
  boton: {
    minHeight: 50,
    marginTop: 8,
    borderRadius: 7,
    backgroundColor: '#b83b17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonPresionado: { backgroundColor: '#963011' },
  botonTexto: { color: '#fff', fontWeight: '800', fontSize: 15 },
  deshabilitado: { opacity: 0.6 },
  pie: {
    color: '#717169',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

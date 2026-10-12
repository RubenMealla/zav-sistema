import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError, iniciarSesion } from '@/lib/api';
import {
  configurarDireccionApi,
  obtenerDireccionApi,
  validarDireccionApi,
} from '@/lib/configuracion-api';
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
  const scrollRef = useRef<ScrollView>(null);
  const [identificador, setIdentificador] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mostrarServidor, setMostrarServidor] = useState(false);
  const [direccion, setDireccion] = useState(obtenerDireccionApi());
  const [servidorActivo, setServidorActivo] = useState(obtenerDireccionApi());
  const [mensajeServidor, setMensajeServidor] = useState('');
  const [comprobandoServidor, setComprobandoServidor] = useState(false);

  useEffect(() => {
    if (!mostrarServidor) return;
    const listener = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => listener.remove();
  }, [mostrarServidor]);

  async function probarYGuardarServidor() {
    if (process.env.EXPO_PUBLIC_BUILD_CHANNEL !== 'qa') return;
    setMensajeServidor('');
    setComprobandoServidor(true);
    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), 8000);
    try {
      const url = validarDireccionApi(direccion);
      const respuesta = await fetch(`${url}/api/v1/salud`, { signal: controlador.signal });
      if (!respuesta.ok) throw new Error('El servidor no respondió correctamente.');
      const cuerpo: unknown = await respuesta.json();
      if (!cuerpo || typeof cuerpo !== 'object' || (cuerpo as { estado?: unknown }).estado !== 'ok') {
        throw new Error('La dirección no corresponde a una API ZAV disponible.');
      }
      const guardada = await configurarDireccionApi(url);
      setServidorActivo(guardada);
      setMostrarServidor(false);
      setMensajeServidor('Servidor de pruebas conectado.');
    } catch (error) {
      setMensajeServidor(error instanceof Error && error.name === 'AbortError'
        ? 'Tiempo de espera agotado (8 segundos). Revisa la IP, Wi-Fi y NestJS.'
        : error instanceof Error ? error.message : 'No se pudo conectar con el servidor.');
    } finally {
      clearTimeout(timeout);
      setComprobandoServidor(false);
    }
  }


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
      <ScrollView
        ref={scrollRef}
        style={styles.desplazamiento}
        contentContainerStyle={[styles.contenido, mostrarServidor && styles.contenidoServidor]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      {process.env.EXPO_PUBLIC_BUILD_CHANNEL === 'qa' && mostrarServidor ? (
        <View style={styles.pantallaServidor}>
          <Text style={styles.eyebrow}>ZAV VENDEDOR QA</Text>
          <Text style={styles.tituloServidor}>Conexión de pruebas</Text>
          <Text style={styles.servidorNota}>
            El celular y la computadora deben estar en la misma red Wi-Fi.
            Escribe la dirección IPv4 de tu PC y el puerto 3001.
          </Text>
          <View style={styles.servidorFormulario}>
            <Text style={styles.label}>Dirección de la API local</Text>
            <TextInput
              accessibilityLabel="Dirección de la API de pruebas"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              placeholder="http://192.168.1.20:3001"
              placeholderTextColor="#8a8982"
              style={styles.input}
              value={direccion}
              onChangeText={setDireccion}
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <Pressable
              accessibilityRole="button"
              disabled={comprobandoServidor}
              onPress={() => { Keyboard.dismiss(); void probarYGuardarServidor(); }}
              style={[styles.servidorBoton, comprobandoServidor && styles.deshabilitado]}
            >
              <Text style={styles.servidorBotonTexto}>
                {comprobandoServidor ? 'Comprobando conexión…' : 'Probar y guardar servidor'}
              </Text>
            </Pressable>
            {mensajeServidor ? <Text style={styles.servidorAviso}>{mensajeServidor}</Text> : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => { Keyboard.dismiss(); setMostrarServidor(false); }}
              style={styles.servidorVolver}
            >
              <Text style={styles.servidorEnlaceTexto}>Volver al inicio de sesión</Text>
            </Pressable>
          </View>
        </View>
      ) : (
      <>
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

      {process.env.EXPO_PUBLIC_BUILD_CHANNEL === 'qa' ? (
        <View style={styles.servidor}>
          <Text style={styles.servidorTitulo}>ENTORNO DE PRUEBAS · NO PRODUCCIÓN</Text>
          <Text style={styles.servidorDireccion} selectable>
            API: {servidorActivo || 'Sin configurar'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => { setMostrarServidor((anterior) => !anterior); setMensajeServidor(''); }}
            style={styles.servidorEnlace}
          >
            <Text style={styles.servidorEnlaceTexto}>
              Configurar API de mi computadora
            </Text>
          </Pressable>
          {mensajeServidor ? <Text style={styles.servidorAviso}>{mensajeServidor}</Text> : null}
        </View>
      ) : null}

      <Text style={styles.pie}>
        Uso interno · El token de sesión se almacena de forma cifrada en el dispositivo.
      </Text>
      </>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#f6f5f0' },
  desplazamiento: { flex: 1 },
  contenido: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  contenidoServidor: { justifyContent: 'flex-start' },
  pantallaServidor: { width: '100%', gap: 15, paddingTop: 8 },
  tituloServidor: { color: '#20201e', fontSize: 25, fontWeight: '800' },
  servidorVolver: { alignItems: 'center', paddingVertical: 10 },
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
  servidor: {
    backgroundColor: '#fffaf6',
    borderWidth: 1,
    borderColor: '#d9b5a3',
    borderRadius: 10,
    padding: 14,
    gap: 9,
  },
  servidorTitulo: { color: '#9b3215', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  servidorDireccion: { color: '#50504a', fontSize: 12, lineHeight: 18 },
  servidorEnlace: { paddingVertical: 6 },
  servidorEnlaceTexto: { color: '#9b3215', fontSize: 13, fontWeight: '800' },
  servidorFormulario: { gap: 9 },
  servidorNota: { color: '#66665e', fontSize: 12, lineHeight: 18 },
  servidorBoton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#262622' },
  servidorBotonTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  servidorAviso: { color: '#8b4a2f', fontSize: 12, lineHeight: 18 },
  pie: {
    color: '#717169',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

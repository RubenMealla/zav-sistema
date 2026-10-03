import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, perfil } from '@/lib/api';
import { borrarSesion, guardarSesion, leerSesion } from '@/lib/sesion';
import type { Sesion } from '@/lib/tipos';
import { LoginScreen } from '@/screens/login-screen';
import { VendedorScreen } from '@/screens/vendedor-screen';

export default function Inicio() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activa = true;

    async function cargarSesionGuardada() {
      try {
        const guardada = await leerSesion();
        if (!guardada) return;

        const usuario = await perfil(guardada.accessToken);
        if (usuario.rol !== 'VENDEDOR') {
          await borrarSesion();
          return;
        }

        if (activa) setSesion({ ...guardada, usuario });
      } catch (error) {
        if (error instanceof ApiError && error.status !== 401 && error.status !== 403) {
          const guardada = await leerSesion();
          if (activa) setSesion(guardada);
        } else {
          await borrarSesion();
        }
      } finally {
        if (activa) setCargando(false);
      }
    }

    void cargarSesionGuardada();
    return () => {
      activa = false;
    };
  }, []);

  async function iniciar(nueva: Sesion) {
    await guardarSesion(nueva);
    setSesion(nueva);
  }

  async function salir() {
    await borrarSesion();
    setSesion(null);
  }

  if (cargando) {
    return (
      <SafeAreaView style={styles.cargando}>
        <ActivityIndicator size="large" color="#b83b17" />
        <Text style={styles.texto}>Verificando sesión…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.segura} edges={['top', 'bottom']}>
      {sesion ? (
        <VendedorScreen sesion={sesion} onCerrarSesion={salir} />
      ) : (
        <LoginScreen onSesion={iniciar} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  segura: { flex: 1, backgroundColor: '#f6f5f0' },
  cargando: {
    flex: 1,
    backgroundColor: '#f6f5f0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  texto: { color: '#66665e', fontSize: 13 },
});

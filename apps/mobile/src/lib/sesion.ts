import * as SecureStore from 'expo-secure-store';
import type { Sesion } from './tipos';

const CLAVE = 'zav_sesion_vendedor_v1';

export async function guardarSesion(sesion: Sesion) {
  await SecureStore.setItemAsync(CLAVE, JSON.stringify(sesion));
}

export async function leerSesion(): Promise<Sesion | null> {
  const valor = await SecureStore.getItemAsync(CLAVE);
  if (!valor) return null;
  try {
    return JSON.parse(valor) as Sesion;
  } catch {
    await SecureStore.deleteItemAsync(CLAVE);
    return null;
  }
}

export function borrarSesion() {
  return SecureStore.deleteItemAsync(CLAVE);
}

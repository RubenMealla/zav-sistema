import * as SecureStore from 'expo-secure-store';

const CLAVE_API_QA = 'zav_api_pruebas_v1';
const API_INICIAL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
export const ES_COMPILACION_QA = process.env.EXPO_PUBLIC_BUILD_CHANNEL === 'qa';

let apiActual = ES_COMPILACION_QA && API_INICIAL ? validarDireccionApi(API_INICIAL) : API_INICIAL;

export function obtenerDireccionApi(): string {
  return apiActual;
}

export function validarDireccionApi(valor: string): string {
  const texto = valor.trim().replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    throw new Error('Ingresa una URL válida, por ejemplo http://192.168.1.20:3001.');
  }

  if (!['http:', 'https:'].includes(url.protocol) ||
      !url.hostname || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Usa solamente la dirección del servidor, sin rutas ni credenciales.');
  }

  if (ES_COMPILACION_QA && url.hostname.toLowerCase().replace(/\.$/, '') === 'zav-api-2026.onrender.com') {
    throw new Error('El APK de pruebas no puede utilizar la API de producción.');
  }

  if (url.protocol === 'http:') {
    const partes = url.hostname.split('.').map(Number);
    const esIpv4 = partes.length === 4 && partes.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
    const esPrivada = esIpv4 && (
      partes[0] === 10 ||
      (partes[0] === 172 && partes[1] >= 16 && partes[1] <= 31) ||
      (partes[0] === 192 && partes[1] === 168)
    );
    if (!esPrivada || !url.port) {
      throw new Error('Para HTTP utiliza la IP privada y el puerto de tu PC (ej. 192.168.1.20:3001).');
    }
  }

  return url.origin;
}

export async function cargarDireccionApi(): Promise<string> {
  if (!ES_COMPILACION_QA) return apiActual;
  const guardada = await SecureStore.getItemAsync(CLAVE_API_QA);
  if (guardada) {
    try {
      apiActual = validarDireccionApi(guardada);
    } catch {
      await SecureStore.deleteItemAsync(CLAVE_API_QA);
    }
  }
  return apiActual;
}

export async function configurarDireccionApi(valor: string): Promise<string> {
  if (!ES_COMPILACION_QA) {
    throw new Error('Esta configuración solo está disponible en la versión QA.');
  }
  const nueva = validarDireccionApi(valor);
  await SecureStore.setItemAsync(CLAVE_API_QA, nueva);
  apiActual = nueva;
  return nueva;
}

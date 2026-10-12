const API = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
export const ES_COMPILACION_QA = false;
export function obtenerDireccionApi() { return API; }
export async function cargarDireccionApi() { return API; }
export function validarDireccionApi(_valor: string): string {
  throw new Error('La dirección de la API está definida por la compilación.');
}
export async function configurarDireccionApi(_valor: string): Promise<string> {
  throw new Error('La dirección de la API está definida por la compilación.');
}

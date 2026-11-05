import * as SecureStore from "expo-secure-store";
import { obtenerDireccionApi } from "./configuracion-api";
import { ApiError, enviarOperacion } from "./api";
import type { OperacionPendiente } from "./operaciones-tipos";

function clave(usuario: string) {
  return `zav.operacion.v1.${usuario}`;
}
export async function leerOperacionPendiente(
  usuario: string,
): Promise<OperacionPendiente | null> {
  const raw = await SecureStore.getItemAsync(clave(usuario));
  if (!raw) return null;
  const p = JSON.parse(raw) as { api: string; operacion: OperacionPendiente };
  if (p.api !== obtenerDireccionApi())
    throw new Error(
      "Hay una operación pendiente para otra API. Vuelve al entorno original para verificarla.",
    );
  if (p.operacion?.version !== 1)
    throw new Error(
      "No se reconoce la operación pendiente. Conserva estos datos y solicita revisión.",
    );
  return p.operacion;
}
export async function ejecutarOperacionPersistida(
  usuario: string,
  token: string,
  operacion: OperacionPendiente,
) {
  const anterior = await leerOperacionPendiente(usuario);
  if (anterior && JSON.stringify(anterior) !== JSON.stringify(operacion))
    throw new Error("Verifica primero la operación pendiente.");
  await SecureStore.setItemAsync(
    clave(usuario),
    JSON.stringify({ api: obtenerDireccionApi(), operacion }),
  );
  try {
    const resultado = await enviarOperacion(
      token,
      operacion.ruta,
      operacion.datos,
    );
    await SecureStore.deleteItemAsync(clave(usuario));
    return resultado;
  } catch (error) {
    // Sin confirmación no se elimina la clave. 401 permite volver a autenticar y recuperar.
    if (
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      ![401, 408, 429].includes(error.status)
    )
      await SecureStore.deleteItemAsync(clave(usuario));
    throw error;
  }
}

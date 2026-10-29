type ProveedorUbicacion = {
  Accuracy: { High: number };
  hasServicesEnabledAsync: () => Promise<boolean>;
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getCurrentPositionAsync: (opciones: {
    accuracy: number;
  }) => Promise<{
    coords: { latitude: number; longitude: number; accuracy: number | null };
    timestamp: number;
  }>;
};
// Una sola lectura por confirmación; no crea suscripciones ni seguimiento en segundo plano.
export async function capturarUbicacionPuntual(proveedor: ProveedorUbicacion) {
  if (!(await proveedor.hasServicesEnabledAsync()))
    throw new Error("Activa la ubicación del teléfono y vuelve a intentar.");
  if (
    (await proveedor.requestForegroundPermissionsAsync()).status !== "granted"
  )
    throw new Error(
      "No se registró la entrega: falta autorizar la ubicación puntual.",
    );
  const posicion = await proveedor.getCurrentPositionAsync({
    accuracy: proveedor.Accuracy.High,
  });
  const { latitude, longitude, accuracy } = posicion.coords;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    throw new Error(
      "El teléfono no obtuvo coordenadas válidas. Intenta nuevamente.",
    );
  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0))
    throw new Error("La precisión reportada no es válida.");
  return posicion;
}

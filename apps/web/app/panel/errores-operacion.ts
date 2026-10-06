export function claveErrorOperacion(estado: number | 'conexion', fallback: string, conflicto?: string): string {
  if (estado === 'conexion') return 'conexion';
  if (estado === 400 || estado === 422) return 'solicitud-invalida';
  if (estado === 404) return 'registro-no-encontrado';
  if (estado === 409 && conflicto) return conflicto;
  if (estado >= 500) return 'servicio';
  return fallback;
}


export function parametrosError(estado: number | 'conexion', clave: string, detalle?: string) {
  const parametros = new URLSearchParams({
    error: clave,
    codigo: estado === 'conexion' ? 'RED' : String(estado),
  });
  if (detalle) parametros.set('detalle', detalle.slice(0, 500));
  return parametros.toString();
}

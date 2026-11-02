type Disponible = { id: string; nombre: string; disponible: number };

/** Conserva lo escrito: nunca convierte 1.5 en 15 ni -3 en 3. */
export function errorCantidad(
  valor: string,
  disponible: number,
): string | null {
  if (valor === "") return null;
  if (
    !/^\d+$/.test(valor) ||
    !Number.isSafeInteger(Number(valor)) ||
    Number(valor) > 2147483647
  )
    return "Ingresa unidades enteras, sin signos ni decimales.";
  if (Number(valor) > disponible)
    return `Solo hay ${disponible} unidades disponibles.`;
  return null;
}

export function validarCantidades(
  cantidades: Record<string, string>,
  disponibles: Disponible[],
  limite = 50,
): string | null {
  const porId = new Map(disponibles.map((p) => [p.id, p]));
  let elegidos = 0;
  for (const [id, valor] of Object.entries(cantidades)) {
    if (valor === "" || /^0+$/.test(valor)) continue;
    const p = porId.get(id);
    if (!p)
      return "Un producto o lote seleccionado ya no está disponible en esta lista. Revisa la selección antes de continuar.";
    const error = errorCantidad(valor, p.disponible);
    if (error) return `${p.nombre}: ${error}`;
    elegidos++;
  }
  if (!elegidos) return "Indica al menos una cantidad de producto.";
  if (elegidos > limite)
    return `Selecciona como máximo ${limite} productos o lotes por operación.`;
  return null;
}

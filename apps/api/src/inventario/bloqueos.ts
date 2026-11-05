import type { EntityManager } from 'typeorm';

// Todas las operaciones que cambian disponibilidad toman este bloqueo, en el mismo orden.
export async function bloquearProductos(
  manager: EntityManager,
  productoIds: string[],
) {
  for (const productoId of [...new Set(productoIds)].sort()) {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [
      `producto:${productoId}`,
    ]);
  }
}

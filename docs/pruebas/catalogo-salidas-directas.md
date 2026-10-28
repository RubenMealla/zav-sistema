# Verificación de catálogo y salidas directas

Estado: ejecución en curso. No representa aceptación completa ni despliegue productivo.

## Evidencias iniciales

- Base Git comprobada: `e9dc1a40476a72034f38e4dabb0e178c62af0066`.
- Pruebas base ejecutadas localmente: 26/26 unitarias API y 11/11 móvil.
- Recursos gráficos: los trece hashes SHA-256 de `public/catalogo-original` coinciden con `docs/evidencias/catalogo-fotografico-original.md`.
- PostgreSQL local nuevo: 18.6, `127.0.0.1:55433`. Las E2E solo pueden recrear `zav_test`, con NODE_ENV=test y credenciales sintéticas.
- Neon ensayo: `ensayo-catalogo-salidas-20261012`, `br-dawn-cake-b6cs8va8`, copiada de production, LSN `0/3091F68`. No se elimina al terminar.

## Respaldo y recuperación comprobada

Ejecutado `apps/api/scripts/respaldo-verificable.mjs`, lectura de production por conexión directa y restauración en una base local nueva. Fuente estable antes/después y coincidencia de huellas en todas las tablas.

- Fecha UTC: `2026-10-13T03:16:01.009Z` (12/10 en Bolivia).
- Archivo privado, excluido de Git: `backups/catalogo-salidas-20261012/production-previa.dump`.
- SHA-256: `622c172c99ce5d41c6d2720201698136c78bc19df7c22470ae1423d65cdaa662`.
- Informe privado: `backups/catalogo-salidas-20261012/verificacion.json`.
- Base restaurada: `zav_restore_catalogo_20261012`.
- Tablas comprobadas: usuario 2; cliente 10; producto 11; lote 10; movimiento 10; pedido 10; detalle_pedido 10; lote_condicion_historial 10; ubicacion 10; typeorm_migraciones 7.
- La primera migración de catálogo se ejecutó sobre esta restauración y luego en Neon ensayo: conserva 11 SKU; incorpora 7 familias y 13 productos publicados.

Esto acredita una restauración de datos, además de una copia de rama. La copia externa contiene información empresarial privada y no se publica como artefacto de Actions.

## Incidencias reales de esta ejecución

| Intento | Resultado observado | Corrección / seguimiento |
|---|---|---|
| Inspección Vercel con teamId explícito | 403 del conector | Misma ID de proyecto sin override: consulta correcta; coincide accountId y commit base. Despliegue previo `dpl_928EeqAEWwUUuZdzNoRXrvEreHxh`, READY. |
| Crear rama Neon con intervalo de suspensión explícito | HTTP 412 por restricción de cuenta; no creó rama | Comprobada inexistencia, creada usando configuración predeterminada. |
| Respaldo usando URL devuelta por conector | Script rechazó hostname pooled antes de leer/copiar | Contrastados endpoints con metadatos Neon; conexión directa para dump. |
| Primer E2E de catálogo | 2 aprobadas, 5 fallidas | Locale C no normalizaba Á; añadir migración correctiva. TypeORM devuelve UPDATE como `[filas,cantidad]`; usar CTE con SELECT para obtener la fila auditada. Fallos encadenados en edición, imágenes y baja. |

No se eliminan pruebas ni se presentan estos intentos como exitosos. Resultados posteriores se añadirán con su alcance y limitaciones.

## Verificación del backend de catálogo

Después de las correcciones, `pnpm --filter @zav/api test:e2e` terminó con **42/42 pruebas, 5 archivos**, contra PostgreSQL 18.6 local (58,88 s). Incluye las siete pruebas nuevas y las regresiones existentes. `pnpm --filter @zav/api lint` y `build` finalizaron con código 0. Esto verifica el backend; todavía no acredita interfaces ni despliegues.

## Verificación de operaciones y custodia

La ejecución completa posterior terminó con **57/57 pruebas, 6 archivos**, en 91,59 s. Incluye 15 escenarios nuevos: FEFO multiproducto, coordenadas históricas, cliente especial, validación comercial, idempotencia simultánea, ventas concurrentes, carga contra pedido, retiro contra venta, custodia ajena, GPS obligatorio, recepción, devolución contra venta, inspección y reversión. Las 26 pruebas unitarias API también finalizaron correctamente.

Intentos conservados: primer recorrido de operaciones, 45 aprobadas/12 fallidas por inferencia incompatible del parámetro SQL tipo (text/varchar); se corrigió con cast explícito. Segundo recorrido, 55 aprobadas/2 fallidas por plural incorrecto de la URL de traslado en el test; se corrigió contra el controlador existente. No se modificaron los resultados esperados para ocultar defectos.

## Continuación del 28 de octubre de 2026

Se comprobó de nuevo la rama de trabajo, el remoto y `origin/main` mediante fetch: la base sigue siendo `e9dc1a40476a72034f38e4dabb0e178c62af0066`. Se conservaron los cambios sin commit de la sesión anterior y los artefactos fallidos de Playwright. PostgreSQL local recuperó su WAL al iniciar después de la interrupción; se volvió a preparar únicamente `zav_test`.

La suite completa API terminó con **60/60 pruebas, 6 archivos, 119,86 s**. Se añadieron verificaciones de inmutabilidad SQL, rechazo de saldo negativo, altas/precios provisionales mediante la API anterior y revalidación de condición del lote después de esperar un bloqueo real. Primer intento: 59/60; una prueba esperaba 409 donde el contrato previo de pedidos devuelve 404 para productos no habilitados. Se corrigió esa expectativa tras revisar el servicio y se comprobó también ausencia de detalles de pedido.

Móvil: **15/15 pruebas** de lógica; lint pasa después de mantener un único diálogo de confirmación activo durante GPS, recepción y devolución. Todavía no equivale a prueba Android instalada. Web: compilación correcta; se detectaron y corrigieron el rechazo de origen legítimo detrás de Next, filtros vacíos/no admitidos y una carrera del test al navegar antes de finalizar login. La repetición E2E web sigue pendiente de resultados.

El respaldo del 12/13 de octubre y el ensayo Neon son evidencias históricas, no un respaldo actualizado para desplegar el 28 de octubre. Antes de producción se deben refrescar identidades, versión, respaldo y ensayo si cambió el estado. No se ha ejecutado una migración productiva durante esta continuación.

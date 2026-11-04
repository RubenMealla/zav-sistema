# Publicación estable ZAV 1.1.0

El propietario autorizó el 04/11/2026 integrar la ampliación a `main` y desplegarla, conservando ramas, commits y evidencias. Esta autorización sustituye la prohibición previa de fusionar el PR #74; se mantiene la prohibición de borrar o reescribir historial.

## Versión y alcance

Versión visible **1.1.0**, build Android/iOS **10104**. QA y release mantienen paquetes distintos. Se retira el sufijo de candidata; los documentos y APK `1.1.0-rc.1` y `1.1.0-rc.2` se conservan. Véanse [changelog](../../CHANGELOG.md), [política de versiones](../operacion/versionado.md) y [comparación con main](../informes/codigos-sincronizacion-1.1.0-rc.2.md).

## Respaldo previo a la integración

- `main` previo: `e9dc1a40476a72034f38e4dabb0e178c62af0066`.
- Rama de respaldo local y remota: `respaldo/main-1.0.0-20261104`.
- Copia completa Git: `backups/publicacion-1.1.0-20261104/repositorio-antes-main.bundle`; SHA256 `30112e806e0a7e100466bb4214d0b5e801def09daa59ac9ddf12318b0a654af4`. `git bundle verify` confirmó historia completa.
- Dump PostgreSQL: `backups/publicacion-1.1.0-20261104/production-previa.dump`; SHA256 `426f4f2f1ea11d84e9f6cab91d37c0febac2845a2d546f9c0be2456204ac04ef`, capturado a `2026-11-04T06:55:44.072Z`.
- Restauración comprobada en `zav_restore_publicacion_20261104`: diez tablas coincidentes, fuente estable durante la copia. Se conservan 13 presentaciones, 13 lotes, 23 movimientos, 10 pedidos y 10 clientes; estas cifras describen la copia técnica, no una estadística empresarial.
- Render previo: servicio `srv-das2iq3ncjis73fk6pc0`, deploy `dep-db6mk9qd0e5s73ass9hg`, fuente `main` y despliegue después de CI aprobado.
- Vercel previo: proyecto `prj_RVYDJQxTxfCmFe3ak2AXgcpwuHwL`, deploy `dpl_928EeqAEWwUUuZdzNoRXrvEreHxh`. `API_BASE_URL` de producción verificado hacia `https://zav-api-2026.onrender.com`; el Preview de desarrollo mantiene API QA.

Los archivos privados contienen datos y no se suben al repositorio ni a la Release pública. Las copias de octubre y noviembre anteriores se conservan.

## Ensayo y conciliación

La creación de otra rama Neon devolvió `branches limit exceeded`. No se eliminó ninguna. Se creó únicamente la base `zav_release_20261104` en la rama QA `br-dawn-cake-b6cs8va8`, se restauró el dump vigente y se ejecutó el mismo publicador de esquema que se utilizará en producción. La base de revisión `zav_catalogo_qa` no se modificó.

Los ensayos local y remoto terminaron con once migraciones, siete familias y trece productos publicados, cero negativos, cero custodias inválidas y cero SKU sin relación. Las huellas de todas las columnas históricas de las filas originales permanecieron iguales.

El backend original `e9dc1a4` también ejecutó el circuito de pedido, retiro y entrega GPS sobre una copia local migrada, con datos sintéticos aislados: reintentos sin duplicados y saldo final correcto. Evidencia privada `compatibilidad-main.json`. No se efectuaron ventas ficticias productivas.

El reemplazo externo de IDs del 29/10 no se deshace ni se mezcla automáticamente con la copia anterior. Se preservan los IDs y operaciones actualmente usados en producción y también la rama histórica `respaldo-production-20261029-antes-datos-iniciales` y los dumps previos. El origen de ese cambio no se atribuye sin evidencia. La migración de publicación no elimina, renumera ni restaura registros antiguos encima de los actuales.

## Aplicación y recuperación

`apps/api/scripts/publicar-esquema.mjs` exige destino explícito, conexión directa con TLS verificable, un dump con hash coincidente y una restauración certificada. Bloquea brevemente las tablas históricas y compara la fuente con el respaldo antes de aplicar cambios. Si los datos cambiaron, se detiene; hay que tomar y ensayar otra copia. Las cuatro migraciones y las verificaciones posteriores se ejecutan en una sola transacción. No se ejecuta `down` ni se vacía una base.

La integración se realiza mediante **merge commit**, conservando la rama de desarrollo. La etiqueta anotada `v1.1.0` y la GitHub Release identificarán el commit integrado. La Release adjuntará APK release, SHA256 y el acta final con los identificadores de despliegue y resultados efectivos; este documento registra los controles previos.

Para volver al código anterior, conservar el esquema ampliado y las operaciones nuevas, resolver primero las cargas/devoluciones pendientes y usar los despliegues/SHA previos. Para recuperar datos, restaurar el dump en otra base y conciliar las operaciones posteriores antes de cambiar la conexión. Nunca restaurar sobre producción ni borrar la base incidente. El [runbook](../operacion/catalogo-salidas-recuperacion.md) conserva el procedimiento detallado; su restricción histórica de no hacer merge queda sustituida por la autorización de esta publicación.

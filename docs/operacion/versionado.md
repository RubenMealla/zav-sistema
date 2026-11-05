# Versionado y publicación de ZAV

ZAV utiliza [Versionado Semántico](https://semver.org/lang/es/): **MAYOR.MENOR.PARCHE**.

- **1.1.0**: catálogo administrable, ventas directas y custodia, conservando los contratos operativos anteriores.
- **1.1.1**: ejemplo de una corrección posterior compatible.
- **1.2.0**: ejemplo de otra ampliación compatible.
- **2.0.0**: reservado para cambios incompatibles que requieran una transición de clientes.

`1.1.0-rc.2` significó segunda candidata de prueba de 1.1.0. Es una nomenclatura normal de prelanzamiento, que se retira al publicar la versión estable. Sus commits, APK e informes permanecen como evidencia.

La versión se mantiene igual en los cuatro `package.json`, Expo y ambos contratos OpenAPI. Ejecutar `pnpm version:check`; para una publicación estable, `pnpm version:check --estable`. GitHub Actions comprueba esta coherencia. El prefijo de rutas `/api/v1` identifica la versión mayor del contrato HTTP, no el número completo de la aplicación.

Android `versionCode` e iOS `buildNumber` son contadores de compilación crecientes, separados de la versión visible. La publicación 1.1.0 usa **10104**, posterior a los candidatos 10102 y 10103. No reutilizar ni reducir el contador al distribuir otra compilación. QA y producción conservan sus paquetes, firma, configuración de API y artefactos separados.

## Procedimiento de publicación

1. Preparar cambios y versión en una rama; registrar novedades y comprobar contratos, migraciones y compilaciones.
2. Guardar una rama de respaldo del `main` previo y una copia Git completa. Respaldar PostgreSQL y demostrar la restauración en otra base.
3. Ensayar migraciones incrementales con la copia vigente y verificar que se mantienen IDs, datos históricos e inventario.
4. Con la autorización del propietario, integrar mediante **merge commit**: sin squash, rebase, force push ni eliminación de ramas. No escribir cambios de desarrollo directamente en `main`.
5. Crear etiqueta anotada `vX.Y.Z` sobre el commit integrado y una GitHub Release estable con changelog, APK firmado y SHA256. Nunca mover una etiqueta publicada; cualquier corrección se publica con otra versión.
6. Comprobar los despliegues y sus conexiones reales; registrar los identificadores previos para recuperación. La recuperación de código y la de datos son procedimientos distintos.

La etiqueta histórica `v1.0.0` apunta a `12a4f3fc462fd720e5969ee23eb5faaecb848d71` y se conserva. El `main` inmediatamente anterior a esta publicación está en `e9dc1a40476a72034f38e4dabb0e178c62af0066`, preservado además en `respaldo/main-1.0.0-20261104`. No se modifica una etiqueta antigua para hacerla coincidir con una entrega posterior.

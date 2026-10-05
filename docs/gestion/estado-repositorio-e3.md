# Estado del repositorio y política de preservación · E3

**Fecha de revisión:** 5 de octubre de 2026  
**Issue de mantenimiento:** #44

## Regla de preservación

Para la defensa del Trabajo Final se conserva el historial técnico completo:

- no se eliminan ramas;
- no se eliminan ni reescriben commits;
- no se borran Pull Requests, Issues, Actions ni artifacts;
- los runs fallidos se mantienen como evidencia de incidencias reales y retesting;
- `main` representa la versión estable integrada, no la única fuente de evidencia.

Las ramas históricas no se consideran trabajo pendiente únicamente por seguir existiendo.

## Líneas principales

| Estado | Rama / referencia | Uso |
|---|---|---|
| Estable | `main` | Versión integrada utilizada por Vercel Production y Render `zav-api-2026`. |
| Activa | `mejora/ui-web-consolidada` · PR #40 · Issue #39 | Última línea válida de interfaz web recuperada y mejorada. Pendiente de nueva revisión visual antes de merge. |
| En cierre QA | `pruebas/e3-evidencias-http` · PR #42 · Issue #41 | OpenAPI, matriz QA, evidencias HTTP y smoke público sin credenciales válidas versionadas. |
| Pausada | `pruebas/e3-capturas-android-v2` · Issue #43 | Automatización experimental de capturas Android. La app estable no depende de este workflow. |
| Evidencia de intento anterior | `pruebas/e3-capturas-android` | Primer intento de screenshots Android; se conserva con sus fallos. |
| Referencia recuperada | `revision/ui-web-local-recuperada` | Recuperación de trabajo local usada como fuente para reconstruir selectivamente PR #40. No se fusiona de forma automática. |
| Histórica de desarrollo móvil | `desarrollo/e3-app-movil-vendedor` | Línea previa a ZAV Vendedor 1.0.0; conserva un ajuste de usuarios demo y alimenta temporalmente `zav-api-e3-dev`. No debe fusionarse directamente a `main`. |

## Ramas integradas que se conservan como evidencia

Las siguientes ramas no contienen trabajo pendiente respecto de `main`; sus cambios ya fueron integrados en etapas anteriores. Se mantienen para demostrar la evolución del proyecto:

- `configuracion/api-backend`
- `configuracion/aplicacion-movil`
- `configuracion/aplicacion-web`
- `configuracion/qa-main-render`
- `correccion/t3-base-e3`
- `desarrollo/e3-pedidos-distribucion`
- `desarrollo/frontend-web`
- `desarrollo/identidad-visual-zav`
- `desarrollo/liberacion-lotes`
- `desarrollo/modelo-datos`
- `desarrollo/permisos-transacciones-inventario`
- `desarrollo/persistencia-postgresql`
- `desarrollo/preparacion-backend`
- `desarrollo/redisenio-ui-web`
- `desarrollo/traslados-inventario`
- `optimizacion/rendimiento-web`
- `pruebas/automatizacion-web-playwright`

Su presencia en GitHub es intencional y no representa deuda técnica activa.

## Pull Requests e Issues vigentes

- **PR #40 / Issue #39:** interfaz web consolidada. Línea funcional activa.
- **PR #42 / Issue #41:** cierre QA/API E3. Debe integrarse con checks verdes.
- **Issue #43:** screenshots Android automáticos. Pausado; fallos conservados.
- **Issue #44:** mantenimiento y orden del repositorio.
- **Issue #37:** Venta Directa. Propuesta futura, pendiente de validar.

Los Issues #32 y #34 fueron cerrados como completados porque su alcance quedó integrado en ZAV Vendedor 1.0.0 mediante PR #35.

## Infraestructura confirmada

### Vercel

- proyecto: `zav-sistema`;
- Production sigue la rama `main`;
- dominio estable: `https://zav-sistema.vercel.app`;
- `API_BASE_URL` de Production apunta a `https://zav-api-2026.onrender.com`;
- los despliegues de PR #40 y otras ramas son Preview y no sustituyen Production.

### Render

- servicio canónico: `zav-api-2026`;
- rama Git: `main`;
- estado observado: `live`;
- salud: `/api/v1/salud` responde `{"estado":"ok"}`.

Existe además `zav-api-e3-dev`, conectado a `desarrollo/e3-app-movil-vendedor`. Se conserva temporalmente como entorno histórico/de desarrollo y no se declara API estable.

### Neon

- proyecto: `zav-sistema`;
- rama de datos actual para E3: `development`;
- rama `production`: Default y reservada para el cierre productivo posterior;
- ramas QA conservadas: `qa-migracion-escalonada-e3`, `qa-migracion-saldos-e3` y `qa-pedidos-e3`.

Las ramas Neon son ramas de base de datos y no deben confundirse con ramas Git.

## Regla para continuar desarrollo

1. Actualizar `main` únicamente mediante PR revisado y QA.
2. No borrar la rama fuente después del merge.
3. Mantener una sola línea funcional en desarrollo según el WIP Kanban.
4. Registrar fallos reales y su retesting.
5. No presentar una rama experimental como versión estable.
6. Antes de continuar UI, comprobar que PR #40 esté actualizado respecto del `main` vigente.

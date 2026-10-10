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
| Estable | `main` | Versión integrada utilizada por Vercel Production y Render `zav-api-2026`; incluye el cierre QA/API de PR #42. |
| Activa | `mejora/ui-web-consolidada` · PR #40 · Issue #39 | Última línea válida de interfaz web recuperada y mejorada. Pendiente de nueva revisión visual antes de merge. |
| Integrada / evidencia | `pruebas/e3-evidencias-http` · PR #42 · Issue #41 | OpenAPI, matriz QA, evidencias HTTP y smoke público sin credenciales válidas. Fusionada a `main` mediante `5e5b50c2`; la rama se conserva. |
| Pausada | `pruebas/e3-capturas-android-v2` · Issue #43 | Automatización experimental de capturas Android. La app estable no depende de este workflow. |
| Evidencia de intento anterior | `pruebas/e3-capturas-android` | Primer intento de screenshots Android; se conserva con sus fallos. |
| Referencia recuperada | `revision/ui-web-local-recuperada` | Recuperación de trabajo local usada como fuente para reconstruir selectivamente PR #40. No se fusiona de forma automática. |
| Histórica de desarrollo móvil | `desarrollo/e3-app-movil-vendedor` | Línea previa a ZAV Vendedor 1.0.0; conserva un ajuste de usuarios demo y alimenta temporalmente `zav-api-e3-dev`. No debe fusionarse directamente a `main`. |
| Integrada / evidencia de mantenimiento | `mantenimiento/estado-repositorio-e3` · PR #45 · Issue #44 | Actualiza README, clasificación de ramas y normaliza el APK de revisión para usar la API estable. La rama se conserva después del merge. |

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
- **PR #42 / Issue #41:** **COMPLETADO**. Fusionado a `main` mediante `5e5b50c2`; rama preservada.
- **Issue #43:** screenshots Android automáticos. Pausado; fallos conservados.
- **Issue #37:** Venta Directa. Propuesta futura, pendiente de validar.

Los Issues #32 y #34 fueron cerrados como completados porque su alcance quedó integrado en ZAV Vendedor 1.0.0 mediante PR #35. El Issue #41 se cerró al integrar PR #42. El Issue #44 se cierra con PR #45; ambas ramas se preservan.

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


---

## Actualización de cierre controlado — 10 de octubre de 2026

Esta actualización conserva las anotaciones históricas de 5 de octubre anteriores; sus estados «activo» o «pendiente» corresponden a aquella fecha. La presente sección establece el estado del cierre de pruebas E3 de GitHub, sin alterar los despliegues externos.

### Integraciones verificadas en la rama principal

- [PR #55](https://github.com/RubenMealla/zav-sistema/pull/55): integrado mediante commit de fusión `d9dd562e14b09768d248717158f7267bda6dc290`. Preserva pruebas de Swagger, interfaz web y Android, scripts, índices y reportes. El código estable de compilación APK, QA móvil y Playwright se mantuvo sin modificaciones durante esa integración.
- [PR #58](https://github.com/RubenMealla/zav-sistema/pull/58): integrado mediante commit de fusión `dec74d07acfda7a2a828424fae856f5909f8710f`. Corrige parámetros posicionales de PostgreSQL en filtros administrativos y añade una prueba de regresión. [QA backend #38028994064](https://github.com/RubenMealla/zav-sistema/actions/runs/38028994064) y [Playwright #38028994215](https://github.com/RubenMealla/zav-sistema/actions/runs/38028994215) aprobaron antes de la fusión. Las ejecuciones sobre `main` #38029213091 y #38029213089 aprobaron antes de repetirlas como verificación de cierre.
- [PR #56](https://github.com/RubenMealla/zav-sistema/pull/56) se cerró sin fusionar la automatización Android experimental, reemplazada por una línea posterior validada.
- [PR #48](https://github.com/RubenMealla/zav-sistema/pull/48) se cerró sin fusionar debido a conflictos y cambios parcialmente incorporados en `main`. La ampliación del límite de paginación de 100 a 150 **no forma parte de la versión estable**, y no se declara implementada.
- [Issue #37](https://github.com/RubenMealla/zav-sistema/issues/37), venta directa, se cerró como **no planificada en el alcance actual**, sin atribuirle implementación.

### Clasificación de las 36 ramas antes de esta actualización documental

Comparadas contra `main` en el commit `dec74d07`:

- `main`: 1 rama estable;
- 27 ramas son ancestros de `main` y tienen **cero commits exclusivos pendientes**;
- ocho ramas tienen commits históricos exclusivos, sin considerarse trabajos aprobados ni integrables automáticamente:
  `desarrollo/e3-app-movil-vendedor`, `fix/backend-panel-web-geografia-paginacion-v2`, `pruebas/e3-android-evidencias-diagnostico`, `pruebas/e3-capturas-android`, `pruebas/e3-capturas-android-v2`, `pruebas/e3-evidencias-http`, `pruebas/evidencias-qa-2-8-reales` y `revision/ui-web-local-recuperada`.

Las ramas `pruebas/evidencias-qa-reales`, `pruebas/e3-qa-android-gps-ruta-v2` y `fix/cierre-e3-consulta-pedidos-parametros` **están integradas** (sin commits exclusivos pendientes); se mantienen sus referencias y commits por trazabilidad. Las ramas `respaldo/*` se conservan intencionalmente.

La existencia de una rama divergente no equivale a una funcionalidad lista para fusión. **No se eliminaron ramas, commits, solicitudes históricas ni ejecuciones**, ni se utilizó rebase, squash, restablecimiento forzado o force push.

### Evidencias técnicas de la versión

- [Evidencias Android #127](https://github.com/RubenMealla/zav-sistema/actions/runs/37765155527): 11/11 casos operativos correctos, más capturas básicas y entrega GPS autorizada, con 40 imágenes funcionales y 13 reportes JSON correctos. APK real en emulador Android 13; datos y ubicación sintéticos, servidor local aislado. No demuestra actividad física ni comportamiento de la base productiva.
- [Playwright web #770](https://github.com/RubenMealla/zav-sistema/actions/runs/38027357314) y [APK release #322](https://github.com/RubenMealla/zav-sistema/actions/runs/38027357295) aprobaron después de integrar las evidencias del PR #55.
- [QA backend #616](https://github.com/RubenMealla/zav-sistema/actions/runs/38029213091) y [Playwright web #773](https://github.com/RubenMealla/zav-sistema/actions/runs/38029213089) aprobaron sobre `main` después del PR #58.
- Desde `d9dd562e` hasta `dec74d07` solo se modificaron dos archivos del servidor: `apps/api/src/pedidos/pedidos.service.ts` y `apps/api/src/pedidos/pedidos-auditoria-parametros.spec.ts`. No hubo cambios del código de la aplicación móvil ni de workflows; el APK release sigue configurado para `https://zav-api-2026.onrender.com`.

**Conservación:** los archivos descargables de Actions tienen retención limitada (habitualmente 30 días, según el workflow). Se recomienda resguardar una copia externa del paquete de imágenes Android #127 y de las evidencias web, además de los enlaces a las ejecuciones. La fusión de código **no** garantiza retención indefinida de archivos ZIP de Actions.

**Documento académico:** las evidencias móviles ya fueron integradas en un documento Word del estudiante, fuera del código Git. No se afirma que el archivo Word esté versionado en este repositorio. La integración documental no sustituye las pruebas de un dispositivo físico ni de producción.

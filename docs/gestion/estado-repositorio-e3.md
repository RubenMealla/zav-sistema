# Estado del repositorio y ramas · cierre E3

Fecha de revisión: 5 de octubre de 2026.

Este registro organiza las ramas sin eliminar historial. Las ramas y commits se conservan como evidencia del proceso de desarrollo, QA, correcciones y fusiones realizadas durante el proyecto.

## Rama estable

- `main`: versión estable integrada. En la revisión corresponde al commit `12a4f3fc` (ZAV Vendedor 1.0.0).
- Render estable: `zav-api-2026`, rama Git `main`.
- Vercel Production: seguimiento de `main`.
- Neon: durante E3 se trabaja con la rama de datos `development`; `production` se reserva para el cierre productivo.

## Ramas activas

| Rama | Estado respecto a main | Propósito |
| --- | --- | --- |
| `mejora/ui-web-consolidada` | 21 commits por delante, 0 por detrás | Última iteración de mejora visual web. PR #40 permanece en revisión visual. |
| `pruebas/e3-evidencias-http` | rama de QA/documentación | Evidencias HTTP, matriz QA, contrato OpenAPI y smoke público. PR #42. |
| `pruebas/e3-capturas-android-v2` | rama de QA | Automatización de capturas Android. Se mantiene aislada hasta obtener una ejecución estable. |
| `desarrollo/e3-app-movil-vendedor` | divergida: 1 commit propio, 6 commits por detrás | Conservada porque contiene la preparación temporal de usuarios demo del backend development. No fusionar automáticamente a main. |
| `revision/ui-web-local-recuperada` | 1 commit por delante | Recuperación histórica de UI usada como antecedente para la rama consolidada. |
| `pruebas/e3-capturas-android` | 1 commit por delante | Primer intento de automatización Android. Se conserva como evidencia del fallo y de la iteración de QA. |

## Ramas históricas ya absorbidas por main

Las siguientes ramas no contienen commits pendientes respecto a `main`. Se conservan deliberadamente como evidencia del trabajo incremental y de las fusiones realizadas:

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

## Política de conservación

- No eliminar ramas utilizadas en el desarrollo o QA.
- No reescribir ni borrar commits históricos.
- Las ramas fusionadas se mantienen como trazabilidad para la defensa.
- Las ramas activas deben cerrarse mediante Pull Request cuando su alcance esté aprobado.
- No fusionar una rama solo porque el CI esté verde: las tareas visuales requieren también validación humana.
- Las ejecuciones fallidas de CI se conservan como evidencia natural de detección, corrección y retesting.

## Pull Requests abiertos al momento de la revisión

- PR #40: mejora web consolidada. Técnicamente mergeable y con QA verde; pendiente de revisión visual y de incorporar las últimas decisiones del estudiante.
- PR #42: evidencias HTTP E3. Técnicamente mergeable; antes del cierre se retiraron credenciales demo escritas directamente del workflow.

## Observaciones de infraestructura

- La API canónica es `https://zav-api-2026.onrender.com`.
- `zav-api-e3-dev` es un servicio temporal de desarrollo y no debe confundirse con la API canónica.
- El APK release de `main` utiliza `zav-api-2026`.
- Los Pull Requests todavía deben normalizarse para no depender del backend temporal una vez concluida la transición E3.

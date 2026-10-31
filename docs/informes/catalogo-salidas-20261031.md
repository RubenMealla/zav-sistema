# Continuación verificada — 31/10/2026

**QA remoto operativo; producción pendiente.** Este informe actualiza el [informe del 29/10](catalogo-salidas-20261029.md), conserva sus antecedentes y distingue las verificaciones nuevas. No acredita finalización productiva.

## 1. Rama y base

`desarrollo/ventas-directas-catalogo`. Base `e9dc1a40476a72034f38e4dabb0e178c62af0066`. Fetch del 31/10 confirma main y origin/main en ese SHA. Código desplegado en QA: `0fbbee401595c9ab816d5bc13b5c827c55e25a8a`. No se modificó main ni se fusionó el PR.

## 2. Commits

Los commits funcionales y correcciones están enumerados en el informe anterior. Después se incorporaron `fed5a88` (evidencia QA), `0fbbee4` (respaldo e incidencia de datos) y esta continuación con scripts reproducibles, conexiones QA y evidencias desplegadas. El historial completo está en [los commits del PR](https://github.com/RubenMealla/zav-sistema/pull/74/commits).

## 3–4. Arquitectura, tablas y migraciones

Se mantiene la [arquitectura implementada](../arquitectura/catalogo-salidas-directas.md): familia → producto comercial → producto/SKU existente. Cuatro migraciones incrementales, sin reemplazar IDs históricos: `1791856800000`, `1791856860000`, `1791856920000`, `1791856980000`. Tablas de catálogo, imágenes persistentes, auditoría, operaciones, detalles, asignaciones y eventos; custodia derivada de movimientos. No se añade otra fuente de saldo.

## 5–8. Catálogo, salidas, inventario e interfaces

El ensayo desplegado comprobó siete familias y trece productos públicos, alta de presentación provisional y validación únicamente para QA, permisos 401/403, alta de lote, liberación, traslado, ubicación sintética del despacho, venta administrativa, idempotencia exacta y rechazo de contenido distinto, carga/recepción, GPS obligatorio, venta del vendedor, devolución a inspección y conciliación.

Desde Chromium contra Vercel se verificó login con formulario real, creación/publicación de familia, aparición inmediata en landing y ocultación sin reconstruir el sitio. También se confirmó una venta desde la interfaz web y se comprobó su saldo en la API. Capturas auténticas: [venta confirmada](../evidencias/qa-catalogo-20261031/venta-directa.png), [landing a 390 px](../evidencias/qa-catalogo-20261031/landing-movil.png). Se esperó la carga de las imágenes y se verificó ausencia de desbordamiento horizontal.

Por SKU del último ensayo: ingreso 12, venta administrativa HTTP 2, carga 5, venta del vendedor 2, devolución 1 y venta web 1. Resultado: despacho 4, custodia libre del vendedor 2, inspección 1 y salidas definitivas 5. Los importes, coordenadas y operaciones de este ensayo son sintéticos y solo están en QA.

## 9. Neon

Proyecto `fancy-darkness-96751098`. Se creó una **base vacía independiente** `zav_catalogo_qa` dentro de `br-dawn-cake-b6cs8va8`, la rama de ensayo existente. No se copiaron cuentas ni filas empresariales a esa base. Tiene once migraciones y dos cuentas sintéticas. Verificación SQL final: cero saldos negativos, siete familias y trece productos publicados. La base `neondb` anterior de esa rama no se reinicializó.

Producción `br-dry-hat-b6mxo2xi/neondb` conserva siete migraciones, 13 SKU, 13 lotes, 23 movimientos y 10 pedidos. No recibió escrituras en esta continuación. Existe además `br-noisy-shadow-b6dg2opt`, respaldo previo al cambio externo del 29/10: 11 SKU, 10 lotes, 11 movimientos y 10 pedidos. No se borró ni restauró ninguna rama.

## 10. Render

Nuevo servicio QA de plan **free**, sin despliegue automático: `srv-dbj4ia8u01pc73ef4850`, [zav-api-catalogo-qa](https://zav-api-catalogo-qa.onrender.com/api/v1/salud). Deploy `dep-dbj4iaou01pc73ef48rg`, estado `live`, SHA `0fbbee4`. Su DATABASE_URL apunta a `zav_catalogo_qa`; JWT distinto del productivo. Se conservaron los otros dos servicios.

Producción sigue en `srv-das2iq3ncjis73fk6pc0`, deploy `dep-db6mk9qd0e5s73ass9hg`, SHA base. El conector actual permite leer y crear QA, pero no seleccionar otro commit/rama en el servicio productivo ni consultar sus variables. No se ejecutó un trigger que volvería a desplegar main. El navegador administrativo alternativo no está disponible en esta sesión.

## 11. Vercel

Preview verificado: [zav-sistema-qqtlx18z8](https://zav-sistema-qqtlx18z8-dariomealla24-6763.vercel.app), deploy `dpl_HejhVYH2LmUxF1wQsyG5GQAGMaRV`, `READY`, SHA `0fbbee4`. Variable `API_BASE_URL` de **esta rama y ambiente preview** apunta al nuevo backend QA. Se mantuvieron las variables de otras ramas y producción.

La protección de Vercel permanece activa. La automatización utilizó un enlace de acceso temporal de dos horas, sin publicarlo en Git. El usuario puede entrar con su sesión de Vercel. Producción conserva `dpl_928EeqAEWwUUuZdzNoRXrvEreHxh`, SHA base; no se promovió el Preview.

## 12–13. Actions y resultados

| Comprobación | Resultado y evidencia |
|---|---|
| API, SHA 0fbbee4 | [40880804531](https://github.com/RubenMealla/zav-sistema/actions/runs/40880804531), éxito: 26 unitarias y 60 E2E |
| Web, SHA 0fbbee4 | [40880804588](https://github.com/RubenMealla/zav-sistema/actions/runs/40880804588), éxito: 37 Playwright |
| Móvil, SHA 0fbbee4 | [40880804721](https://github.com/RubenMealla/zav-sistema/actions/runs/40880804721), éxito: 15 pruebas, tipos y lint |
| Android QA | [40880804616, intento 2](https://github.com/RubenMealla/zav-sistema/actions/runs/40880804616/attempts/2), éxito: APK, hora Bolivia y recorrido completo con GPS/red/devolución |
| Android release final | [40878996274](https://github.com/RubenMealla/zav-sistema/actions/runs/40878996274), éxito, SHA fed5a88; mismos archivos de aplicación que 0fbbee4 |
| QA remoto | 26 comprobaciones HTTP y recorrido Chromium con login, publicación/ocultación y venta web, salida 0; [resultado](../evidencias/qa-catalogo-20261031/resultado.json) |

APK QA: [artefacto 12901971735](https://github.com/RubenMealla/zav-sistema/actions/runs/40880804616/artifacts/12901971735), SHA-256 `f724bb98f18d1fa3bbf88ed4707f97d8cb76a566d923dc7511b61438334b760b`. [Evidencia Android](../evidencias/qa-catalogo-20261031/android.json), [artefacto del recorrido](https://github.com/RubenMealla/zav-sistema/actions/runs/40880804616/artifacts/13056352424). El SHA de prueba eafe19c es la referencia sintética de Actions del PR, no un merge a main.

APK release: [artefacto 12901225647](https://github.com/RubenMealla/zav-sistema/actions/runs/40878996274/artifacts/12901225647), SHA-256 comprobado tras descargar `e92394c4f4f002328e4cbf62a32b029c5475a0bb7beeb5d83c4abc2cdcb14f67`, 149373153 bytes; copia local `backups/apk-release-355/ZAV-Vendedor-1.1.0-build10100-release.apk`. No está habilitada para probar operaciones nuevas contra producción antigua.

Se configuró `ZAV_QA_API_BASE_URL` en GitHub para futuras APK QA. Las ya compiladas permiten introducir esa URL en Configurar API; sus pruebas automatizadas siguen apuntando al backend local aislado.

## 14. Intentos y correcciones

El primer intento Android de 40880804616 falló porque un ANR de **Pixel Launcher** tapó el formulario de ZAV. Se revisaron captura/XML/logs, se conservaron y se repitió solo el job fallido; no se quitaron aserciones. El segundo intento pasó. El primer ensayo web remoto seleccionaba «Guardar» en lugar de «Guardar cambios» en el diálogo: se corrigió el script y se repitió. Un ensayo adicional confirmó la venta web y esperó imágenes para capturar evidencias completas. No se borraron operaciones sintéticas de intentos anteriores.

## 15–16. Respaldos y recuperación

Se conservan las copias de 12, 28 y 29/10 y sus restauraciones verificadas. Último dump: `backups/catalogo-salidas-20261029/production-previa.dump`, SHA-256 `d725a3b818f56aa6578f33a7e7cfe2072c890ca226a8368f2774b571e0094962`. Fuente estable, restauración coincidente y ensayo de las cuatro migraciones con huellas preservadas. No se considera una copia fresca de producción del 31/10; deberá refrescarse antes de migrar.

El [runbook](../operacion/catalogo-salidas-recuperacion.md) separa retorno de código y recuperación de datos. Guardar un respaldo posterior a cualquier incidente, restaurar en otra base y conciliar nuevas escrituras antes de cambiar conexiones. No ejecutar down destructivo ni restaurar encima de datos actuales.

## 17. Pendientes concretos

- Aclarar si los 13 SKU actuales son el conjunto vigente autorizado y cómo conservar/conciliar el historial anterior reemplazado externamente. Se solicitó esa decisión; no se dedujo de los nombres ni del paso del tiempo.
- Con esa información, refrescar backup, ensayar la copia actual, comprobar variables productivas de Render, seleccionar explícitamente el commit de la rama y verificar la API y web productivas. El conector necesita una vía adicional para seleccionar el commit/configuración del servicio existente.
- Validar pesos, empaques, precios y coordenadas empresariales reales. Los valores de QA no son información oficial.
- El recorrido Android se probó en emulador; no se afirma instalación o prueba en el teléfono personal del usuario.

## 18. Prueba del usuario y reproducción

Entrar al Preview con la sesión de Vercel y seguir la [guía funcional](../operacion/catalogo-salidas-guia.md). Cuentas QA: `admin.catalogo@zav.test` y `vendedor.catalogo@zav.test`; contraseñas generadas disponibles solo en el archivo local ignorado `backups/catalogo-qa-secrets.json` (`adminPassword`, `vendorPassword`). No compartir su campo JWT.

API QA para la APK: `https://zav-api-catalogo-qa.onrender.com`, sin `/api/v1`. En Render free el primer acceso puede tardar al reactivarse.

Scripts ejecutables desde sus respectivas carpetas:

```powershell
# apps/api: requiere el .env ignorado de la base QA verificada
node --env-file=.env.catalogo-qa scripts/preparar-catalogo-qa.mjs
# apps/web: requiere credenciales locales y acceso temporal vigente al Preview
node scripts/verificar-catalogo-desplegado.mjs
```

Los scripts tienen destinos fijos de QA y no aceptan producción. La preparación conserva cuentas existentes; cada ensayo genera SKU y operaciones sintéticas identificables, sin borrar historial.

## 19. PR y gestión

[PR #74](https://github.com/RubenMealla/zav-sistema/pull/74), abierto, borrador, sin merge. [Issue #73](https://github.com/RubenMealla/zav-sistema/issues/73). Se actualizó la [tarjeta existente de Trello](https://trello.com/c/eIqdC2Y0), preservando su lista y antecedentes, sin duplicarla. Los checks históricos de esa tarjeta no equivalen a aceptación productiva de esta ampliación. Monografía final sin modificaciones.

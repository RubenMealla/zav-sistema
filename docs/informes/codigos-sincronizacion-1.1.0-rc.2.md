# Códigos y coherencia entre web y Android — 1.1.0-rc.2

Verificaciones: 3–4 de noviembre de 2026 (marcas UTC en las evidencias). Entrega: 4 de noviembre. Rama: `desarrollo/ventas-directas-catalogo`.

Comparación contra `main` y `origin/main`, verificados con `git fetch origin`: `e9dc1a40476a72034f38e4dabb0e178c62af0066` (1.0.0). Punto anterior de esta revisión: `8ef70e51998218806b9c9b42267bec632133f1a4`. PR: [#74](https://github.com/RubenMealla/zav-sistema/pull/74), sin fusionar.

Commits funcionales de esta revisión:

- `e71a49593f628ccea8a9e5daf8c9e3b538133e55`: sugerencias de código en API y nombres comerciales vigentes.
- `86f49788a789ae299151d3ce2ab5e7488d23a3b6`: formularios asistidos, búsquedas, actualización entre clientes y versión 1.1.0-rc.2. Es el código desplegado y el origen del APK build 10103.

La arquitectura, tablas y migraciones de la ampliación se conservan; consultar el [informe de implementación](catalogo-salidas-20261031.md) y la [auditoría previa de interfaz y coherencia](auditoria-coherencia-1.1.0-rc.1.md). Este informe añade la revisión final de códigos y actualización de datos, sin sustituir las evidencias anteriores.

## Cambios funcionales

1. **SKU asistido:** elegir familia completa el siguiente código interno. Puede reemplazarse antes de guardar; el botón Sugerir vuelve a calcularlo. La API usa todos los códigos, conserva inactivos y rechaza duplicados concurrentes. Una sugerencia no reserva el número.
2. **Lote físico:** se mantiene la propuesta editable `TJ-ZAV-SKU-fecha-correlativo`. Una fecha nueva no reemplaza un código manual. Las fechas reales, la etiqueta física y el registro sanitario son conceptos distintos.
3. **Búsqueda en formularios:** presentaciones, lotes de traslado, cambios de condición e historiales consultan toda la base por nombre o código. Se eliminó la dependencia exclusiva de los primeros 100 productos o primeros 50 lotes que carga una pantalla. La búsqueda limita cada respuesta a 50 coincidencias y pide afinar cuando hay más; no descarga el inventario entero.
4. **Actualización entre clientes:** las pantallas vuelven a consultar al recuperar foco/primer plano y cada 30 segundos mientras están visibles. Las operaciones siguen confirmándose únicamente con respuesta válida del backend. No hay suscripción instantánea ni escrituras desde los temporizadores.
5. **Conservación de edición:** los modales y campos web enfocados suspenden la actualización automática. En móvil se suspenden los refrescos de ventas durante selección, confirmación o solicitudes pendientes. Se conservan cantidades, claves idempotentes y formularios; las respuestas de consultas anteriores no deben reinsertar pedidos tras una escritura posterior.
6. **Nombres vigentes:** catálogo, selectores, disponibilidad para pedidos, disponibilidad de venta y custodia usan el nombre comercial actual. Una nueva operación guarda ese nombre en su copia histórica; las operaciones ya registradas conservan su copia original. No se reescriben nombres ni códigos históricos en `producto` para actualizar la pantalla.
7. **Paginación:** se quitó la opción de 150 filas del panel, incompatible con el máximo 100 de la API. La URL antigua con 150 se normaliza a 20.

## Comparación crítica con 1.0.0

| Área | Main 1.0.0 | Ampliación | Evaluación |
|---|---|---|---|
| Identidad comercial | SKU con familia y nombre escritos en texto | Familia → producto comercial → presentación, conservando `producto.id` | Evita nombres repetidos/inconsistentes y permite varias presentaciones. No hace falta crear un producto comercial distinto por cada peso. |
| Publicación | Catálogo React estático | Publicación administrable e imágenes persistentes | Permite cambiar la landing sin reconstruirla; publicación no implica stock. |
| Códigos | Sugerencias en rutas web, con lectura paginada de registros | Sugerencia central en API y editor nuevo integrado | Recupera la ayuda anterior y elimina el límite de lectura y la aritmética numérica imprecisa. |
| Pedido comercial | Cliente, reserva, retiro FEFO y entrega GPS | Se conserva el mismo flujo y estados | Venta directa es una operación adicional; Consumidor final no entra en pedidos ni rutas. |
| Mercancía en reparto | Ubicación lógica `EN_DISTRIBUCION` | Custodia por vendedor/lote y finalidad, derivada de movimientos | Necesaria para que el stock libre no consuma pedidos ni mercancía ajena. No es un segundo saldo editable. |
| Devoluciones | Sin circuito de sobrantes libres | Solicitud, recepción e inspección | Devuelve trazabilidad y evita convertir un sobrante no inspeccionado en stock vendible. |
| Actualización de pantallas | Carga inicial, acciones propias y refresco manual | También foco, primer plano y consulta periódica | Reduce pantallas desactualizadas cuando otro usuario modifica los datos. |
| Historia | Referencias al SKU y precios de pedido | Identidad preservada y copia comercial en nuevas operaciones | Los cambios de precio o nombre no reinterpretan comprobantes existentes. |
| Facturación/caja | No implementadas | No implementadas | Se mantiene el alcance de entrega física, sin inventar cobros ni facturas. |

**Cómo interpretar las cantidades:** disponibilidad para crear pedidos = stock elegible del despacho menos compromisos. Venta directa del Administrador usa ese mismo cálculo. Venta directa del Vendedor = mercancía libre recibida y elegible bajo su propia custodia. Estas cantidades pueden diferir correctamente. El inventario físico también incluye lotes retenidos o mercancía en inspección que no puede venderse.

**Dictamen:** familia, producto y presentación cumplen funciones distintas y son pertinentes para este catálogo. La redundancia que debía evitarse era volver a escribir esos nombres en cada SKU; se resuelve con selectores y relaciones. La custodia también es necesaria: la ubicación compartida `EN_DISTRIBUCION` de 1.0.0, por sí sola, no identifica a quién pertenece la mercancía ni cuál está libre. Los recorridos anteriores se mantienen y sus regresiones ejecutadas pasan. Esto no certifica ausencia absoluta de defectos ni sustituye la revisión del propietario en su teléfono.

## Datos e infraestructura

- No se añaden migraciones en rc.2. Se conservan las 11 migraciones QA de la ampliación; no se cambió el esquema ni se restablecieron datos de Neon durante esta revisión.
- Consulta QA real: proyecto `fancy-darkness-96751098`, rama `br-dawn-cake-b6cs8va8`, base `zav_catalogo_qa`. Resultado previo al despliegue: 5 presentaciones, 0 pedidos y 40 movimientos; 0 saldos físicos negativos, 0 custodias negativas, 0 libres negativos, 0 SKU sin producto comercial, 0 custodias sin responsable y 0 diferencias físico/custodia. Son resultados de una lectura puntual de QA, no estadísticas empresariales.
- Los ensayos con registros sintéticos se ejecutan en `zav_test` local/Actions. La base QA que el usuario está revisando se conserva.
- Render QA previo: `dep-dbkt7lgae00c73c0v1mg`, código `9f9f4ef2281c25e693dad9c0a2cc2bce9b3f7d3e`. Despliegue automático desactivado; cada actualización se controla manualmente.
- Render QA actual: `dep-dbl72s61egvs73dvklkg`, servicio `srv-dbj4ia8u01pc73ef4850`, estado `live`, commit `86f49788a789ae299151d3ce2ab5e7488d23a3b6`. Finalizó el `2026-11-03T23:44:45.631Z`. [API QA](https://zav-api-catalogo-qa.onrender.com/api/v1/salud).
- Vercel QA actual: `dpl_8aq7m7uknVjpGagTUxwhj7rgLCLr`, estado `READY`, mismo commit, [Preview rc.2](https://zav-sistema-7j9ov0y7c-dariomealla24-6763.vercel.app). El acceso temporal se entrega en privado y vence el 10/11/2026 a las 19:43:44 de Bolivia; la protección del Preview permanece habilitada.
- Producción permanece en 1.0.0: Render `dep-db6mk9qd0e5s73ass9hg` y Vercel `dpl_928EeqAEWwUUuZdzNoRXrvEreHxh`, ambos en `e9dc1a40476a72034f38e4dabb0e178c62af0066`. Lectura de Neon productivo `neondb`, rama `br-dry-hat-b6mxo2xi`: 7 migraciones, 0 saldos negativos. No se escribieron datos productivos ni se cambió su configuración. El paso definitivo a producción sigue pendiente de los controles de migración documentados y la decisión del propietario sobre la integración.

## Verificación y entrega

Resultados sobre `86f49788a789ae299151d3ce2ab5e7488d23a3b6`:

| Verificación | Resultado real | Evidencia |
|---|---|---|
| API | 26 unitarias y 69 HTTP/PostgreSQL aprobadas; build y lint correctos | [Actions API](https://github.com/RubenMealla/zav-sistema/actions/runs/41741246699) |
| Web | 42 Playwright aprobadas en local y Actions; build correcto y lint sin errores | [Actions Web](https://github.com/RubenMealla/zav-sistema/actions/runs/41741246838) |
| Móvil | 20 pruebas aprobadas; tipos, lint y exportación correctos | [Actions Móvil](https://github.com/RubenMealla/zav-sistema/actions/runs/41741246831) |
| Android | APK firmado, identidad QA, GPS, sincronización de carga, recepción, venta, detalle, reintento y devolución aprobados | [Actions Android](https://github.com/RubenMealla/zav-sistema/actions/runs/41741246815) |
| Hora Android | Hora boliviana correcta con dispositivo en UTC y Tokio | Mismo workflow Android, artefacto `hora-bolivia-android-369` |
| OpenAPI/Postman | Ambos contratos sin errores de sintaxis; 2 solicitudes y 3 aserciones locales aprobadas | Registros locales; no se subieron credenciales a Postman |
| Preview y API remotos | Login real, versión rc.2, códigos asistidos y manuales, pantallas a 390 px, nombres coherentes y custodia conciliada; 0 errores JavaScript, 0 escrituras de negocio | [Evidencia sanitizada](../evidencias/codigos-sincronizacion-20261104.json) |

La ejecución local final de web concluyó con **42 aprobadas en 15,3 minutos**; Actions ejecutó las mismas 42 en 2 minutos. Los avisos de lint existentes no se presentan como errores ni se ocultaron. Los ensayos Android usan PostgreSQL aislado `zav_test`, no la base QA del propietario.

Primera ejecución web completa: 39 aprobadas y 3 fallidas. Se detectó un desborde del encabezado a 390 px (corregido con ancho flexible y ajuste de línea), un selector cuya etiqueta ahora incluye la presentación (prueba actualizada para seleccionar por valor) y un ensayo de fecha futura que ya era rechazado al sugerir el código (se usa código físico manual para conservar la comprobación independiente HTTP 400). Se conservó el resultado inicial en `backups/codigos-rc2-intento1/test-results`; no se quitaron pruebas.

La prueba web nueva comprueba una alta de SKU sugerido, búsqueda de un producto creado después de abrir el modal, conservación de código físico y regeneración explícita. Otra prueba usa el contrato del Vendedor para crear/cancelar un pedido mientras el Administrador ya tiene la web abierta y verifica la actualización del stock. La prueba Android nativa añade una carga desde administración con la pantalla de recepción ya abierta, sin pulsar Actualizar.

Android confirmó `cargaSincronizadaSinRecargar`, `permisoDenegadoSinSalida`, `respuestaInciertaRecuperadaTrasReabrir`, `reintentoMismaSolicitud` y `conciliado`, todos verdaderos. El flujo terminó con 2 unidades libres en el ensayo. El checkout virtual del PR fue `9989ef0113476abaa0b607142783955bcd25859c`; se verificó por API de GitHub que su árbol `baab0d822e51f98556597afcdd026a2ffdf69760` coincide exactamente con el árbol de `86f49788`. Esto no es un merge en `main`.

## Acceso y APK

- [APK QA 1.1.0-rc.2, build 10103](https://github.com/RubenMealla/zav-sistema/actions/runs/41741246815/artifacts/13282776458), paquete `bo.zav.gestion.vendedor.qa`. El paquete productivo `bo.zav.gestion.vendedor` continúa separado. El workflow verificó firma, manifiesto y bundle.
- Archivo: `ZAV-Vendedor-1.1.0-rc.2-build10103-qa.apk`, 149.410.197 bytes. SHA256 `cb62365377a1599f9d75b5ab8740509b4bdf5eae956f7e722e7a7a8752382821`, cotejado con el artefacto descargado y con el APK realmente usado por las pruebas Android.
- Copia local entregada en `C:\Users\Ruben\Downloads\ZAV-1.1.0-rc.2-2026-11-04`, con acceso privado web, instrucciones y suma SHA256. La API QA ya está configurada en el APK; no requiere arrancar Expo.
- [Guía funcional de web y móvil](../operacion/catalogo-salidas-guia.md). Instalar como actualización de **ZAV Vendedor QA**, conservando la app productiva. Las cuentas de revisión se entregan en privado.

## Recuperación y límites

- rc.2 no transforma datos: para regresar a rc.1 basta desplegar su código y conservar la misma base QA. Los códigos registrados durante rc.2 siguen siendo compatibles. Conservar ambos APK y referencias de despliegue.
- Retorno concreto: desplegar el commit API `9f9f4ef2281c25e693dad9c0a2cc2bce9b3f7d3e` en Render QA, usar el Preview Vercel rc.1 `dpl_DrHUauCZfrAURdL3Cmg471tWsMGF` y la APK QA build 10102 conservada. Android puede exigir desinstalar para bajar de 10103 a 10102: primero resolver cualquier operación pendiente, porque la desinstalación borra su almacenamiento local. No se restaura ni se vacía PostgreSQL para ese retorno.
- El retorno de toda la ampliación a 1.0.0 y la recuperación de PostgreSQL se describen por separado en los informes previos; restaurar código no restaura datos. Respaldo previo existente: `backups/catalogo-salidas-20261101-verificado/production-previa.dump`, SHA256 `c12eeb1230f30463dd71bc489a231b012ebc11819ff9ec59efe29e13fae2cbdd`. No se presenta como un respaldo nuevo de esta revisión.
- La actualización automática depende de conectividad, pantalla visible y ausencia de una edición protegida. No equivale a tiempo real; también se conserva Actualizar y el gesto de refrescar.
- El resumen de inventario anterior continúa indicando explícitamente que sus indicadores de condición/existencia se calculan sobre los lotes consultados. No debe interpretarse como un consolidado de todos los lotes.
- No se ha confirmado una convención física distinta ni un registro sanitario de ZAV. Se conserva la sugerencia editable; no se genera un registro SENASAG ni se certifican etiquetas.
- No se publicó una APK productiva rc.2: la API productiva sigue en 1.0.0. Antes de promover toda la ampliación siguen pendientes la revisión del cambio externo de SKU, un respaldo fresco y el ensayo sobre los datos productivos vigentes, según el [runbook](../operacion/catalogo-salidas-recuperacion.md). Los resultados QA no reemplazan esos controles.

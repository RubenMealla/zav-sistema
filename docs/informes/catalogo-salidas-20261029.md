# Informe de implementación — catálogo y salidas directas

Fecha: 29/10/2026. Estado: implementación y QA aprobados en la rama; despliegue productivo pendiente de acceso técnico. **No constituye aceptación productiva completa.** Las limitaciones se detallan en el punto 17.

## 1. Rama y base

`desarrollo/ventas-directas-catalogo`, base completa `e9dc1a40476a72034f38e4dabb0e178c62af0066`. Se verificó origin, se hizo fetch y avance rápido de main antes de crear la rama. Main permanece sin cambios propios y el PR no se fusiona. Se conserva `.idea/` local sin incorporarla.

## 2. Commits progresivos

| Commit | Resultado |
|---|---|
| `154b4c5` | Auditoría, diseño y contrato |
| `19599f4` | Catálogo relacional, publicación e imágenes |
| `b915c71` | Salidas, cargas, custodia y devoluciones |
| `d27a93c` | Guardas SQL e integración de validación comercial |
| `d82e846` | Aplicación móvil, GPS y reintentos persistentes |
| `808dd47` | Interfaces web, landing dinámica y OpenAPI |
| `a43e7fe` | Correcciones web, compilaciones y prueba Android |
| `07aa042` | Compatibilidad con API anterior, fixtures Bolivia y recuperación |
| `397acc9` | Espera del árbol accesible Android y evidencia sanitizada |
| `a17d031` | GPS denegado, respuesta incierta, contraste y hora boliviana |
| `cbe774e` | Arranque Android determinista; cuatro workflows aprobados |

El historial completo, incluidos intentos fallidos y correcciones posteriores, está disponible en los commits del PR. No se reescribió ni borró historial.

## 3. Arquitectura

Se amplía NestJS con módulos de catálogo y operaciones. `producto` sigue siendo el SKU y conserva todas sus relaciones anteriores. Pedidos y operaciones comparten disponibilidad, FEFO y bloqueos por producto. Las interfaces web usan la sesión existente y un proxy de rutas permitidas; móvil conserva JWT, geolocalización puntual y almacenamiento seguro. No se añadió facturación, caja ni cobros.

## 4. Persistencia y migraciones

Cuatro migraciones incrementales: `1791856800000`, `1791856860000`, `1791856920000`, `1791856980000`. Incorporan `familia`, `producto_comercial`, `imagen_catalogo`, `catalogo_auditoria`, `operacion_inventario`, `detalle_operacion`, `asignacion_operacion` y `evento_operacion`; amplían SKU, cliente y movimiento. Vistas de custodia derivadas de movimientos, sin saldo editable independiente. Se añaden restricciones y guardas de inmutabilidad, validación comercial y saldo no negativo. Los `down` destructivos se rechazan.

## 5. Catálogo

CRUD de familias, productos y presentaciones con filtros y selectores relacionados. Se separan activo, publicado y disponible. SKU único permanente; cambios que reinterpretan historial se rechazan. Importes NUMERIC y snapshot de precio solamente cuando está validado. Presentaciones nuevas PROVISIONAL hasta validación; no se generan SKU arbitrarios para los trece productos originales. Las fotografías originales se conservan y las nuevas se validan/recodifican y persisten en PostgreSQL.

## 6. Salidas directas

Administrador: despacho libre de compromisos, Consumidor final protegido, coordenadas históricas del despacho y asignación FEFO. Vendedor: exclusivamente su custodia libre recibida, GPS puntual y precisión. La salida registra detalles, lotes, movimientos y responsable obtenido del JWT. Una respuesta incierta conserva la misma solicitud idempotente para verificar/reintentar.

## 7. Inventario y custodia

Carga: traslado del despacho a EN_DISTRIBUCION, con vendedor y recepción. Pedido y carga libre mantienen finalidades separadas. La devolución pendiente inmoviliza unidades; al recibirla el Administrador mueve a inspección. No reintegra productos automáticamente al stock vendible. Las reversiones de ventas exigen recepción física confirmada y motivo; conservan el historial.

## 8. Web y móvil

Web: Catálogo, Venta directa y Mercancía en distribución, historial, detalle y conciliación; landing conectada a proyección pública sin inventario ni usuarios. Se mantiene diseño y navegación existentes. Móvil: pestaña independiente con venta, cargas/devolución e historial propio; solicitud pendiente persistida por usuario y entorno. Los flujos anteriores de pedidos y reparto se mantienen.

## 9–11. Neon, Render y Vercel

Neon producción conserva siete migraciones. Neon ensayo `br-dawn-cake-b6cs8va8` tiene once, sin pérdida de huellas históricas ni negativos. La restauración local del respaldo reciente también fue migrada y verificada.

Render producción identificado previamente: `srv-das2iq3ncjis73fk6pc0`, despliegue `dep-db6mk9qd0e5s73ass9hg`. Vercel: proyecto `prj_RVYDJQxTxfCmFe3ak2AXgcpwuHwL`, despliegue anterior `dpl_928EeqAEWwUUuZdzNoRXrvEreHxh`. Ambos correspondían al commit base. Los plugins vuelven a figurar instalados, pero no exponen herramientas administrativas en esta sesión; el navegador alternativo tampoco está disponible. No se ha podido refrescar configuración/variables y promover de forma comprobada. Los Preview automáticos de Vercel no equivalen a un QA integrado con API nueva. Salud productiva devuelve 200 y el catálogo nuevo 404: la ampliación no está desplegada allí.

## 12–13. Actions y pruebas

| Verificación real | Resultado / referencia |
|---|---|
| API unitarias e integración | 26 unitarias y 60 E2E; [CI 40835458249](https://github.com/RubenMealla/zav-sistema/actions/runs/40835458249) exitoso |
| Web Playwright | 37/37, sin flaky en [CI 40835458273](https://github.com/RubenMealla/zav-sistema/actions/runs/40835458273) |
| Móvil lógica, tipos y lint | 15 pruebas; [CI 40835458243](https://github.com/RubenMealla/zav-sistema/actions/runs/40835458243) exitoso |
| Postman local | 2 solicitudes, 3 aserciones, guardas de destino local; OpenAPI syntax lint sin violaciones |
| API anterior / esquema ampliado | Pedido, retiro, entrega GPS y reintentos correctos; saldo 7 de 10; once migraciones |
| APK QA 1.1.0/build10100 | Compilada, firmada y probada en [40835458262](https://github.com/RubenMealla/zav-sistema/actions/runs/40835458262): recepción, GPS denegado, venta, respuesta incierta, reapertura/reintento y devolución aprobados |
| APK release 1.1.0/build10100 | Compilada y firmada en [40804411892](https://github.com/RubenMealla/zav-sistema/actions/runs/40804411892), exitoso; no publicada ni instalada para operar producción |

APK QA final SHA-256 `0dcadda60dc23aabb13c5f264e626310c4a4bf452f7b0f425ecf612a5f9e86af`; release histórica `a1e305ae38e031ce08d129868402853cd1aea703e99c0c2e1e9960ce2f86149a`. La release histórica corresponde a `a43e7fe` y está en `backups/apk-release-345`. La QA final corresponde al head `cbe774e`, comprobado por Actions en su referencia de prueba del PR `01304f5ccd8d6b88420a44b48b500d8f08f0345b`; esto no es una fusión en main.

Resultado Android: cinco unidades cargadas, dos vendidas, una devuelta a inspección y dos libres. GPS denegado no produjo salida. El 503 se inyectó después de confirmar en PostgreSQL; al reabrir, la app recuperó la misma solicitud y el backend conservó una sola venta. [Resultado JSON](../evidencias/android-catalogo-salidas-20261029.json) y [artefacto completo](https://github.com/RubenMealla/zav-sistema/actions/runs/40835458262/artifacts/12881407870).

[Descarga de APK QA verificada](https://github.com/RubenMealla/zav-sistema/actions/runs/40835458262/artifacts/12881237543). Repetición independiente del flujo ampliado sobre la APK anterior: [40877868452](https://github.com/RubenMealla/zav-sistema/actions/runs/40877868452), aprobada. Se conservan las ejecuciones anteriores fallidas.

## 14. Defectos detectados y corregidos

Normalización de nombres acentuados; retorno SQL de UPDATE; tipos SQL de operaciones; validación comercial en rutas heredadas; filtros no admitidos; origen del proxy detrás de Next; diálogos que no cerraban; navegación fuera de pantalla; proxy/ejemplos de Swagger; fixtures con fecha UTC; espera de estilos del mapa; foco del automatizador Android y árbol accesible ausente al arrancar. Se mantienen los logs y artefactos de cada intento. Los casos seriales Swagger requieren un presupuesto global de 120 segundos en la máquina local; no se relajaron sus aserciones HTTP.

## 15. Respaldo

Copia `backups/catalogo-salidas-20261028/production-previa.dump`, SHA-256 `e84df3bad5a9a18ca3bf718ec1045fd5e512c63d7c1b390ded29382b35a579c1`. Restaurada realmente en PostgreSQL 18.6; fuente estable y huellas coincidentes. Se conserva también la copia del 12/10. [Evidencia sanitizada](../evidencias/catalogo-salidas-20261028.json); dumps y datos privados no se suben a GitHub.

## 16. Recuperación

[Runbook](../operacion/catalogo-salidas-recuperacion.md): detener escrituras, conservar copia posterior al incidente, resolver/inmovilizar custodia pendiente, volver al despliegue/SHA anterior manteniendo esquema e historial. Si se recuperan datos, restaurar a otra base y conciliar escrituras posteriores antes de cambiar conexiones. No confundir rollback de código con restauración de PostgreSQL.

## 17. Limitaciones pendientes

- El recorrido instalado Android ya está aprobado, incluyendo permiso denegado y respuesta incierta. La release final debe conservar su enlace/hash de compilación; no se utiliza para ventas nuevas contra la API antigua.
- Recuperar acceso administrativo a Render/Vercel para contrastar versión y base actuales; preparar QA conectado, promover y verificar endpoints desplegados. No se ejecutó migración productiva sin ese control.
- Validar comercialmente pesos, empaques y precios nuevos; configurar coordenadas reales de despacho. Los valores sintéticos no son oficiales.
- Confirmar Trello cuando vuelva a estar disponible; issue y PR sí actualizados.
- La API anterior no administra cargas/devoluciones nuevas ni valida comercialmente los SKU nuevos; el retorno requiere el procedimiento documentado.

## 18. Cómo probar

Seguir la [guía funcional](../operacion/catalogo-salidas-guia.md) en entorno aislado. Para ejecución automática, las E2E exigen `NODE_ENV=test`, PostgreSQL local `zav_test` y cuentas sintéticas. El pipeline Android instala únicamente el paquete QA en emulador y verifica resultados contra PostgreSQL real. No introducir ventas de prueba en Neon production.

## 19. Pull Request

[PR #74 — catálogo administrable y salidas directas](https://github.com/RubenMealla/zav-sistema/pull/74), abierto y sin fusionar. La aceptación final debe contrastarse con la [matriz de requisitos](../pruebas/matriz-catalogo-salidas.md) y las [evidencias de ejecución](../pruebas/catalogo-salidas-directas.md). La monografía académica final no se modificó.

# Matriz de requisitos y evidencia

Problema confirmado: catálogo público fijo y ausencia de registro específico para entregas ocasionales y custodia libre. Objetivos: catálogo relacional editable y trazabilidad de salidas sin sustituir pedidos. Fuente: requisitos del propietario; no se atribuyen entrevistas ni estadísticas no realizadas. Gestión UAJMS 2026. [Issue 73](https://github.com/RubenMealla/zav-sistema/issues/73) → rama `desarrollo/ventas-directas-catalogo` → [PR 74](https://github.com/RubenMealla/zav-sistema/pull/74).

“Verificado” se refiere al entorno indicado, no a disponibilidad en producción. Las pruebas automatizadas agrupan varias aserciones por caso. Su número no mide cobertura completa.

| Requisito | Diseño e implementación | Prueba / evidencia | Estado |
|---|---|---|---|
| Familias y productos comerciales | `familia`, `producto_comercial`, CRUD administrativo, normalización de nombres | `catalogo.e2e-spec.ts`, `catalogo-salidas.spec.ts` | API y web verificadas |
| SKU, empaque, peso, precio editable | `producto` conserva ID; NUMERIC; selectores relacionados; auditoría y validación comercial | E2E catálogo e inventario | Verificado; datos comerciales reales pendientes del propietario |
| Historial e identidad de SKU | Código permanente, bloqueo de cambios de identidad con historial | E2E catálogo, guardas SQL | Verificado |
| Siete familias / trece productos reales | Migración de nombres y fotografías originales; no genera presentaciones arbitrarias | Hashes de imágenes, ensayo local y Neon | Verificado |
| Preservar registros anteriores | Grupos heredados ocultos, sin reasignar por similitud | Huellas de las diez tablas antes/después | Verificado en restauración y ensayo |
| Landing dinámica | API pública con proyección cerrada; publicación jerárquica; no-store | Playwright catálogo, Postman público | Verificado local/CI; pendiente despliegue conectado |
| Fotos persistentes y seguras | BYTEA, Sharp valida y recodifica; tamaño/dimensiones; acceso por publicación | E2E imágenes y permisos | Verificado |
| Salida administrador / consumidor final | JWT, cliente especial protegido, FEFO y snapshot de despacho | E2E operaciones, Playwright venta | Verificado local/CI |
| Despacho real | Reutiliza georreferencia; rechaza venta sin coordenadas | E2E snapshot y validación; enlace UI | Función verificada; punto productivo pendiente de configuración real |
| Venta vendedor / GPS puntual | Pestaña propia, custodia libre, precisión y vigencia, responsable JWT | E2E operaciones y APK: GPS válido/denegado | Verificado |
| Carga / recepción | Traslado físico y estado pendiente; disponibilidad tras recepción | E2E carga y stock libre, APK instalado | Verificado |
| Separación de pedidos / vendedores | Vistas derivadas de movimientos; finalidad PEDIDO/LIBRE; alcance por actor | E2E stock ajeno, compromisos y concurrencia | Verificado |
| Devoluciones e inspección | Reserva pendiente y recepción administrativa hacia inspección | E2E venta contra devolución, vigencia, retorno; APK instalado | Verificado |
| Conciliación | `saldo_inventario`, `saldo_custodia`, `custodia_libre`; ningún saldo independiente editable | E2E conciliación, ensayo migraciones | Verificado |
| Idempotencia y red incierta | Clave + contenido + actor; persistencia local por usuario y entorno; no confirmar sin API | E2E y APK: 503 posterior al commit, reapertura y solicitud idéntica sin duplicación | Verificado |
| Concurrencia y FEFO | Bloqueos comunes por producto, relectura de condición tras bloqueo, transacción | E2E dos ventas, retiro/venta, pedido/carga, venta/devolución, bloqueo de lote | Verificado en PostgreSQL real |
| Auditoría / reversión | Snapshots, eventos, movimientos inmutables; recepción física a inspección | E2E guardas SQL y reversión | Verificado |
| Autorización | JWT y roles backend; listado propio, no confía en usuario del cuerpo | E2E permisos y stock ajeno; Postman 401 | Verificado |
| Regresión anterior | Clientes, pedidos, retiro individual/múltiple, distribución, entrega, lotes, traslados | Suites existentes conservadas; API antigua contra esquema nuevo | Verificado local/CI dentro de casos existentes |
| Android QA/release | Paquetes distintos, versión 1.1.0/build10100, firma y restricción HTTP | Workflow APK, pruebas móvil y recorrido Android completo | QA final aprobada; release histórica compilada, recompilación final en seguimiento |
| Respaldo y recuperación | Dump custom, hash, restauración nueva, huellas; retorno de código separado de datos | Copias 12/10 y 28/10; runbook | Restauración local comprobada; conmutación productiva no ejecutada |
| Producción y entornos | Identidades documentadas, ensayo Neon aislado | Lecturas SQL y salud; metadatos históricos | Pendiente acceso administrativo actual Render/Vercel y despliegue |
| Git y gestión | Commits progresivos, main intacta, PR abierto sin merge | GitHub commits/Actions/PR | Verificado; Trello sin acceso durante continuación |

Los resultados detallados y los intentos fallidos se conservan en [Verificación](catalogo-salidas-directas.md). Procedimiento de retorno: [Recuperación](../operacion/catalogo-salidas-recuperacion.md). Prueba manual: [Guía](../operacion/catalogo-salidas-guia.md). La monografía académica final no fue editada.

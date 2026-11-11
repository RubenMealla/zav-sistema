# Cambios de ZAV

## 1.1.1 — candidata en revisión

- Selección de fotografías con vista previa, estado de carga, deshacer y recuperación ante errores en familias y productos.
- Retiro de formularios, funciones y dependencias sin uso; se conservan los módulos operativos y el historial.
- Configuración local separada de producción, plantillas por aplicación y controles automáticos para impedir archivos privados en Git.
- Credenciales sintéticas de CI generadas por ejecución y revisión del historial con valores redactados.
- Actualización compatible de Next.js, NestJS y dependencias transitivas de seguridad. Los avisos pendientes de Expo se registran en el issue #72.

La candidata actual es `1.1.1-rc.2`, build `10106`. No sustituye la versión estable hasta la revisión y aprobación del propietario.

## 1.1.0 — 2026-11-04

### Funcionalidades

- Catálogo de familias, productos comerciales y presentaciones con imágenes, precios, validación comercial y publicación dinámica.
- Venta directa administrativa y móvil, Consumidor final, FEFO, GPS puntual, trazabilidad e idempotencia.
- Cargas, recepción, custodia por vendedor y devolución de sobrantes hacia inspección.
- Códigos SKU y lote asistidos; búsquedas por nombre/código y actualización de consultas entre web y móvil.

### Correcciones y compatibilidad

- Vistas separadas, detalles en ventanas, avisos flotantes y formularios que conservan los datos al fallar.
- Nombres comerciales actuales sin reescribir copias históricas; protección de pedidos comprometidos y stock ajeno.
- Se conserva el circuito Clientes → Pedidos → Retiro → Distribución → Entrega, los IDs históricos y `movimiento` como fuente de inventario.
- Cuatro migraciones incrementales, sin borrado de datos. No se incorporan facturación ni cobros.

La versión fue revisada como `1.1.0-rc.1` y `1.1.0-rc.2`; sus informes y ejecuciones se conservan. El acta de publicación registra los despliegues y respaldos efectivos.

## 1.0.0 — versión anterior

Sistema original de catálogo por SKU, inventario, lotes, clientes, pedidos y distribución. Se mantienen las etiquetas históricas, las ramas, los commits, los issues y las ejecuciones de Actions.

# Historial de versiones de ZAV

Se registran versiones de cada aplicación por separado. Las verificaciones de funcionamiento se sustentan en las pruebas del repositorio.

## ZAV Web 1.0.0 — primera versión estable

Se identifica como versión estable la aplicación administrativa y su sitio público ya integrados:

- Página pública de información y catálogo visual de presentaciones.
- Acceso restringido del Administrador y navegación por módulos.
- Gestión de productos, lotes, condición comercial y movimientos de inventario.
- Consulta administrativa de pedidos y configuración de la ubicación de Venta y Despacho.
- Identificador visible de versión en página pública, pantalla de acceso y panel, derivado de `apps/web/package.json`.

**No representa una funcionalidad nueva de ventas directas ni un catálogo público dinámico conectado a pedidos.** La actualización de versionado no altera las reglas de negocio, los permisos ni la base de datos.

## ZAV Vendedor 1.0.0 — compilación Android 10000

La aplicación móvil conserva el primer número de versión estable registrado, con funciones de gestión de clientes y pedidos, retiro de productos, organización del reparto y entrega con ubicación puntual. Sus verificaciones y compilación de APK figuran en los workflows y documentos de pruebas. No se modifica su número de versión por cambios exclusivos de ZAV Web.

## ZAV API 1.0.0 — primera versión estable del backend

Se identifica de manera independiente el servidor NestJS utilizado por ZAV Web y ZAV Vendedor. Su versión se define en `apps/api/package.json` y se consulta mediante `GET /api/v1/version`.

La respuesta presenta el servicio, la versión de publicación (`1.0.0`) y la versión mayor del contrato (`v1`), sin divulgar datos sensibles. Esta identificación no modifica las operaciones de autenticación, inventario ni pedidos; la ruta de salud continúa verificando la conexión con PostgreSQL. Se mantienen las pruebas de API y de integración para asegurar compatibilidad con ambos clientes.

## Mantenimiento futuro

Registrar solo cambios realmente implementados, revisados y publicados. El historial Git permite identificar la evolución, pero el identificador de commit no reemplaza al número de versión de la aplicación.

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

## Mantenimiento futuro

Registrar solo cambios realmente implementados, revisados y publicados. El historial Git permite identificar la evolución, pero el identificador de commit no reemplaza al número de versión de la aplicación.

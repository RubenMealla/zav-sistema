# Catálogo administrable y salidas directas

Estado: diseño en implementación; cada resultado se acreditará mediante pruebas. Issue: https://github.com/RubenMealla/zav-sistema/issues/73.

## Base auditada

Rama `desarrollo/ventas-directas-catalogo`, creada tras `git fetch origin`, comprobación con `git ls-remote` y avance rápido de `main`. SHA base: `e9dc1a40476a72034f38e4dabb0e178c62af0066`. No se modifica ni fusiona `main`.

Versiones instaladas: Node 24.20.0, pnpm 12.4.2, NestJS 12.0.3, TypeORM 1.1.1, pg 8.23.0, Next.js 16.3.8, React web 19.2.8, Expo 57.0.24, React Native 0.86.3 y React móvil 19.2.3. Neon production informa PostgreSQL 18.6.

Inventario auditado: `movimiento` es la fuente de verdad; `saldo_inventario` suma destinos y resta orígenes. La disponibilidad resta compromisos de pedidos REGISTRADO. Retiro usa FEFO por vencimiento, creación e ID. La vigencia utiliza fecha civil de Bolivia. Las operaciones de reserva, traslado, condición y retiro coordinan bloqueos transaccionales `producto:<uuid>`.

Neon: proyecto `fancy-darkness-96751098`, production `br-dry-hat-b6mxo2xi`, base `neondb`, siete migraciones. Lectura inicial: 11 productos, 10 lotes, 10 movimientos, 10 pedidos, 10 clientes; ningún saldo negativo. Diez SKU tienen lotes y detalles de pedidos. Los once nombres existentes no corresponden exactamente a los trece productos públicos: no se reasignarán por similitud ni se borrarán. Despacho sin coordenadas configuradas.

Render: `srv-das2iq3ncjis73fk6pc0`, `zav-api-2026`, rama main; despliegue previo `dep-db6mk9qd0e5s73ass9hg`, commit igual a la base, estado live. El servicio histórico `zav-api-e3-dev` permanece separado.

Vercel: proyecto `prj_RVYDJQxTxfCmFe3ak2AXgcpwuHwL`, equipo `team_4H2xJXCILc8Z5HluRl6hAwrj`. La inspección MCP devolvió 403; acceso alternativo y despliegue pendientes de verificar.

Línea base ejecutada: 26/26 pruebas unitarias API y 11/11 móvil. No equivalen a pruebas de las ampliaciones.

## Decisiones

1. Conservar `producto` como SKU y sus IDs. Añadir `familia` y `producto_comercial`; conservar las columnas anteriores para lectura de clientes antiguos. Las asociaciones se incorporan sin reinterpretar historial. Los grupos heredados quedan ocultos de la landing.
2. Importar las siete familias y trece productos confirmados con los PNG originales, sin generar automáticamente SKU productivos. Los datos de ejemplo son explícitamente PROVISIONAL; no pueden originar operaciones reales. El precio validado se representa con decimal y se conserva en cada transacción. Los importes no se suman con coma flotante.
3. Separar activo, publicado y disponibilidad. La API pública usa una proyección explícita sin inventario ni datos personales. La visibilidad depende de producto y familia. Despublicar también retira destacados.
4. Guardar nuevas imágenes validadas en PostgreSQL, con límite de bytes y dimensiones, identificación de contenido y acceso según publicación. Se evita agregar un servicio de pago y depender de discos efímeros. Los trece PNG originales permanecen intactos en los recursos estáticos.
5. Compartir disponibilidad, bloqueos y selección FEFO en el módulo de inventario; pedidos y operaciones nuevas usan las mismas reglas dentro de la transacción.
6. Registrar operaciones de inventario con cabecera, detalles históricos y movimientos asociados. Carga, venta y devolución son operaciones distintas; la venta no crea pedido ni factura.
7. Derivar custodia por vendedor, lote y finalidad LIBRE/PEDIDO de movimientos. Las cargas pendientes de recepción y devoluciones pendientes de validación no son vendibles. No persistir otro saldo editable.
8. Conservar EN_DISTRIBUCION como ubicación lógica. Carga mueve desde VENTA_DESPACHO; venta descuenta definitivamente; devolución recibida va a un área de inspección. Solo después de inspección administrativa y validación de condición/vigencia se permite reintegrar al despacho mediante un traslado auditado.
9. Consumidor final es un cliente especial protegido, excluido de pedidos, selectores de clientes comerciales y rutas. El responsable procede del JWT.
10. Venta web conserva coordenadas del despacho; sin configuración responde conflicto y enlaza a Distribución. Venta móvil captura GPS puntual y precisión. Ante respuesta incierta conserva solicitud y clave para consultar/reintentar, incluso tras volver a abrir la pantalla.
11. Toda operación crítica compara su solicitud normalizada y actor con el registro idempotente. Bloquea productos en orden estable antes de releer disponibilidad y condición. No hay escritura parcial.
12. No borrar operaciones ni movimientos. Una corrección de una salida confirmada requiere recepción física y una reversión administrativa auditada hacia inspección; volver a desplegar código no restaura datos.

## Contrato funcional previo a implementación

Prefijo `/api/v1`. Errores: 400 validación, 401 sin sesión, 403 rol, 404 recurso ajeno/inexistente, 409 conflicto de negocio/idempotencia, 413 archivo grande, 415 formato no admitido. Listados administrativos paginados `{items,total,page,limit}`.

| Rutas | Métodos | Acceso / propósito |
|---|---|---|
| `/catalogo/familias`, `/catalogo/familias/:id` | GET, POST, PATCH | Administrador; filtros q, activo, publicado; edición y baja lógica |
| `/catalogo/productos`, `/catalogo/productos/:id` | GET, POST, PATCH | Administrador; familiaId y filtros; descripción, características, imagen y publicación |
| `/catalogo/presentaciones`, `/catalogo/presentaciones/:id` | GET, POST, PATCH | Administrador; productoComercialId, SKU, empaque, peso, precio, validación comercial |
| `/catalogo/imagenes` | POST multipart | Administrador; archivo validado y almacenamiento persistente |
| `/publico/catalogo`, `/publico/catalogo/imagenes/:id` | GET | Público; únicamente material autorizado |
| `/operaciones/disponibilidad` | GET | Administrador: despacho libre; Vendedor: custodia propia libre |
| `/operaciones`, `/operaciones/:id` | GET | Administrador: general; Vendedor: propias, con filtros |
| `/operaciones/salidas-directas` | POST | Ambos; operacionClave, detalles[{productoId,cantidad}], observacion; móvil además latitud/longitud/precisionMetros |
| `/operaciones/cargas` | POST | Administrador; vendedorId, operacionClave y detalles; reserva física para recepción |
| `/operaciones/:id/recepcion` | POST | Vendedor destinatario; clave idempotente; habilita mercancía libre recibida |
| `/operaciones/devoluciones` | POST | Vendedor; clave, motivo y detalles por lote; inmoviliza las cantidades solicitadas |
| `/operaciones/:id/recibir-devolucion` | POST | Administrador; clave y observación; traslado a inspección |
| `/operaciones/:id/reversion` | POST | Administrador; clave y motivo; recepción física a inspección de salida previa |
| `/operaciones/custodia` | GET | Vendedor propia; Administrador por vendedor, lote, finalidad y conciliación |

Las respuestas contienen IDs, estados, fechas, detalles históricos, lotes y referencias de movimientos; nunca tokens o cadenas de conexión. OpenAPI se ampliará junto con el contrato ejecutable.

## Migración y recuperación

Orden: auditoría de configuración real → copia externa con hash → restauración en PostgreSQL aislado → migración y regresión en copia → revisión de compatibilidad con API anterior → aplicación controlada → verificación de conteos, snapshots e integridad. No se aplican migraciones productivas antes de cumplir esos pasos.

La migración será incremental y transaccional. No se eliminarán columnas ni claves históricas. El retorno normal revierte el despliegue y conserva las tablas/movimientos nuevos; restaurar un respaldo requiere una ventana controlada y conciliación de operaciones posteriores. Las migraciones no ofrecerán un `down` que destruya historial empresarial.

## Trazabilidad académica

Se consultaron los PDF institucionales disponibles en Downloads: `Formato-Trabajo-Final-Diplomado-Distintas-Areas.pdf` y `Lineamientos-Tecnicos-Trabajo-Final-Diplomado-Desarrollo-Web-y-Apps-Moviles.pdf`. El segundo complementa al primero. La documentación técnica separa diseño, implementación y evidencia; los casos de prueba identificarán escenario, esperado, observado y evidencia. La monografía final no se modifica.

Problema: catálogo fijo y ausencia de trazabilidad de entregas ocasionales. Objetivos: administración relacional, publicación y control de salidas/custodia. Requisitos: especificación del propietario en esta sesión. Diseño: este documento y migraciones. Implementación/pruebas/conclusiones: pendientes de acreditación en el informe de la rama.

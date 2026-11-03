# Códigos y coherencia entre web y Android — 1.1.0-rc.2

Fecha: 3 de noviembre de 2026. Rama: `desarrollo/ventas-directas-catalogo`.

Comparación contra `main` y `origin/main`, verificados con `git fetch origin`: `e9dc1a40476a72034f38e4dabb0e178c62af0066` (1.0.0). Punto anterior de esta revisión: `8ef70e51998218806b9c9b42267bec632133f1a4`. PR: [#74](https://github.com/RubenMealla/zav-sistema/pull/74), sin fusionar.

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

## Datos e infraestructura

- No se añaden migraciones en rc.2. Se conservan las 11 migraciones QA de la ampliación; no se cambió el esquema ni se restablecieron datos de Neon durante esta revisión.
- Consulta QA real: proyecto `fancy-darkness-96751098`, rama `br-dawn-cake-b6cs8va8`, base `zav_catalogo_qa`. Resultado previo al despliegue: 5 presentaciones, 0 pedidos y 40 movimientos; 0 saldos físicos negativos, 0 custodias negativas, 0 libres negativos, 0 SKU sin producto comercial, 0 custodias sin responsable y 0 diferencias físico/custodia. Son resultados de una lectura puntual de QA, no estadísticas empresariales.
- Los ensayos con registros sintéticos se ejecutan en `zav_test` local/Actions. La base QA que el usuario está revisando se conserva.
- Render QA previo: `dep-dbkt7lgae00c73c0v1mg`, código `9f9f4ef2281c25e693dad9c0a2cc2bce9b3f7d3e`. Despliegue automático desactivado; cada actualización se controla manualmente.
- Producción permanece en 1.0.0. La integración en `main` y el paso definitivo a producción siguen pendientes de la decisión del propietario y los controles de migración ya documentados.

## Verificación y entrega

Resultados confirmados hasta la revisión local: API 69 pruebas HTTP/PostgreSQL y 26 unitarias aprobadas; móvil 20 pruebas aprobadas, tipos y lint sin errores; compilaciones API y Next correctas. La ejecución web completa, Android nativo y despliegues se registran al terminar, sin dar por aprobada una ejecución pendiente.

Primera ejecución web completa: 39 aprobadas y 3 fallidas. Se detectó un desborde del encabezado a 390 px (corregido con ancho flexible y ajuste de línea), un selector cuya etiqueta ahora incluye la presentación (prueba actualizada para seleccionar por valor) y un ensayo de fecha futura que ya era rechazado al sugerir el código (se usa código físico manual para conservar la comprobación independiente HTTP 400). Se conservó el resultado inicial en `backups/codigos-rc2-intento1/test-results`; no se quitaron pruebas.

La prueba web nueva comprueba una alta de SKU sugerido, búsqueda de un producto creado después de abrir el modal, conservación de código físico y regeneración explícita. Otra prueba usa el contrato del Vendedor para crear/cancelar un pedido mientras el Administrador ya tiene la web abierta y verifica la actualización del stock. La prueba Android nativa añade una carga desde administración con la pantalla de recepción ya abierta, sin pulsar Actualizar.

## Recuperación y límites

- rc.2 no transforma datos: para regresar a rc.1 basta desplegar su código y conservar la misma base QA. Los códigos registrados durante rc.2 siguen siendo compatibles. Conservar ambos APK y referencias de despliegue.
- El retorno de toda la ampliación a 1.0.0 y la recuperación de PostgreSQL se describen por separado en los informes previos; restaurar código no restaura datos. Respaldo previo existente: `backups/catalogo-salidas-20261101-verificado/production-previa.dump`, SHA256 `c12eeb1230f30463dd71bc489a231b012ebc11819ff9ec59efe29e13fae2cbdd`. No se presenta como un respaldo nuevo de esta revisión.
- La actualización automática depende de conectividad, pantalla visible y ausencia de una edición protegida. No equivale a tiempo real; también se conserva Actualizar y el gesto de refrescar.
- El resumen de inventario anterior continúa indicando explícitamente que sus indicadores de condición/existencia se calculan sobre los lotes consultados. No debe interpretarse como un consolidado de todos los lotes.
- No se ha confirmado una convención física distinta ni un registro sanitario de ZAV. Se conserva la sugerencia editable; no se genera un registro SENASAG ni se certifican etiquetas.

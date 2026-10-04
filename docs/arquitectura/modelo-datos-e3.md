# ZAV 2026 — Modelo de datos para E3

**Estado:** implementación backend verificada en la rama `desarrollo/e3-pedidos-distribucion`; despliegue de esta iteración todavía pendiente.

## Decisión de alcance

El modelo principal se limita a ocho entidades de negocio:

1. Usuario
2. Cliente
3. Producto
4. Lote
5. Ubicacion
6. Movimiento
7. Pedido
8. DetallePedido

`Publicacion` queda fuera del núcleo porque corresponde al alcance Could. `Existencia` dejó de persistirse como entidad: el saldo físico se deriva del historial de `Movimiento`, evitando dos fuentes de verdad.

`lote_condicion_historial` se conserva como estructura técnica de auditoría y no constituye una entidad principal. `saldo_inventario` es una vista calculada, no una tabla de negocio.

## Inventario y disponibilidad

`Movimiento` es la fuente de verdad del inventario físico. Un destino suma cantidad y un origen resta cantidad:

- `INGRESO`: sin origen y con destino;
- `TRASLADO`: origen y destino;
- `RETIRO`: Venta y Despacho → En distribución;
- `ENTREGA`: En distribución → salida del sistema.

La disponibilidad comercial no se guarda como otra existencia. Para un Producto se calcula como:

**stock físico liberado y vigente en Venta y Despacho − cantidades de DetallePedido pertenecientes a pedidos REGISTRADO**.

Esta regla permite reservar pedidos sin duplicar el saldo físico. Cuando un pedido pasa a `EN_DISTRIBUCION`, el retiro ya movió físicamente la cantidad fuera de Venta y Despacho y deja de formar parte del compromiso pendiente.

## Pedido y distribución

`Pedido` usa estados cerrados:

`REGISTRADO → EN_DISTRIBUCION → ENTREGADO`.

Antes del retiro se admite `REGISTRADO → CANCELADO`. La anulación conserva fecha y motivo y no borra el Pedido.

No se permiten saltos directos a Entregado. El retiro y la entrega usan claves de operación persistidas para impedir duplicar la transición ante reintentos.

El retiro asigna lotes con criterio FEFO entre lotes `LIBERADO`, vigentes y con saldo en `VENTA_DESPACHO`. La entrega registra una captura GPS puntual; no existe seguimiento continuo.

`DetallePedido` conserva la cantidad solicitada y el precio unitario aplicado al momento del pedido. El total se deriva de sus detalles y no se persiste como una segunda fuente.

## Estado de implementación

| Elemento | Estado |
|---|---|
| Usuario | IMPLEMENTADO Y DESPLEGADO |
| Producto | IMPLEMENTADO Y DESPLEGADO |
| Lote | IMPLEMENTADO Y DESPLEGADO |
| Ubicacion | IMPLEMENTADO Y DESPLEGADO |
| Movimiento | IMPLEMENTADO; extensión RETIRO/ENTREGA verificada en rama |
| Cliente | IMPLEMENTADO EN RAMA + E2E |
| Pedido | IMPLEMENTADO EN RAMA + E2E |
| DetallePedido | IMPLEMENTADO EN RAMA + E2E |
| lote_condicion_historial | IMPLEMENTADO como auditoría técnica |
| saldo_inventario | IMPLEMENTADO Y DESPLEGADO |
| Existencia persistida | RETIRADA del esquema activo |

Cliente, Pedido y DetallePedido no se declararán en producción hasta aplicar la migración y desplegar la API de esta rama.

## Reglas de integridad

- Los saldos físicos no se sobrescriben mediante un endpoint general.
- Cada movimiento tiene cantidad positiva y una estructura válida para su tipo.
- `operacion_clave` de Movimiento es única.
- Los retiros y entregas son idempotentes por pedido.
- Un Pedido no puede reservar más disponibilidad que la existente.
- Los movimientos administrativos desde Venta y Despacho no pueden consumir stock comprometido por pedidos registrados.
- Un lote liberado con stock comprometido no puede bloquearse si dejaría pedidos sin cobertura.
- Un lote nuevo inicia `RETENIDO`.
- La baja de Producto es lógica.
- La baja de Cliente es lógica mediante `activo`; el registro y sus Pedidos históricos se conservan.
- Un Pedido `REGISTRADO` puede corregirse o pasar a `CANCELADO`; después del retiro no se edita ni se anula.
- Ubicacion permanece parametrizable para permitir nuevas áreas o custodias.

## Evidencia de regresión

Durante la primera ejecución de QA de esta iteración, NestJS no pudo construir `PedidosModule` porque `JwtAuthGuard` requería `UsuarioEntityRepository` en el contexto del módulo. La ejecución falló antes de los casos E2E. Se corrigió importando `TypeOrmModule.forFeature([UsuarioEntity])` y la regresión posterior obtuvo 11/11 pruebas unitarias y 18/18 E2E. Este fallo real se conserva como evidencia del apartado 2.8.


## Extensión geográfica propuesta para distribución

**Estado:** PROPUESTO / PENDIENTE DE IMPLEMENTAR. La especificación completa está en `docs/arquitectura/geolocalizacion-distribucion-e3.md`.

Se mantienen las ocho entidades principales. No se crea una entidad Ruta.

Cambios propuestos:

- **Cliente:** `latitud`, `longitud`, `ubicacion_confirmada_en`.
- **Ubicacion:** coordenadas opcionales para `AREA_FISICA`; `VENTA_DESPACHO` se utilizará como origen geográfico del reparto. `CUSTODIA_LOGICA` no representa un punto fijo.
- **Pedido:** snapshot de destino mediante `destino_latitud` y `destino_longitud`; la posición real de entrega continúa en `entrega_latitud` y `entrega_longitud`; se propone registrar además precisión, distancia respecto al destino y observación cuando corresponda.

La planificación de varios pedidos se calculará bajo demanda y no se persistirá como una novena entidad. Se propone ordenar por proximidad mediante distancia Haversine y heurística de vecino más cercano. El resultado será una sugerencia editable, no una ruta óptima.


## Decisión de cierre E3 · integridad histórica

**Cliente:** se reutiliza el atributo `activo` ya existente. Esta es la única representación de alta/baja del Cliente; no se incorpora un segundo mecanismo de soft delete.

**Pedido:** no se elimina. `CANCELADO` representa una anulación de negocio y conserva `cancelado_en` y `cancelacion_motivo`. Esta distinción evita presentar como “borrado” una operación que debe permanecer disponible para auditoría.

**Justificación de defensa:** el Cliente es un maestro reutilizable y puede dejar de operar sin desaparecer; el Pedido es una transacción y, si fue registrado incorrectamente, debe quedar evidencia de su anulación. Una vez que el Pedido genera movimientos de inventario mediante Retiro, la trazabilidad física prevalece y se bloquea la corrección destructiva.

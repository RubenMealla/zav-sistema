# ZAV 2026 — Modelo de datos para E3

**Estado:** diseño vigente de la iteración E3.

## Decisión de alcance

El modelo principal queda limitado a ocho entidades de negocio: Usuario, Cliente, Producto, Lote, Ubicacion, Movimiento, Pedido y DetallePedido.

Publicacion queda fuera del núcleo porque corresponde al alcance Could. Existencia deja de persistirse como entidad: el saldo físico se deriva del historial de Movimiento para evitar dos fuentes de verdad.

La tabla lote_condicion_historial se conserva como estructura técnica de auditoría y no constituye una entidad principal. La vista saldo_inventario es una proyección calculada, no una tabla de negocio.

## Justificación del saldo derivado

Un destino suma cantidad y un origen resta cantidad. INGRESO tiene destino sin origen y TRASLADO resta en origen y suma en destino. La migración 1790380800000-saldos-derivados.mjs valida antes de retirar la tabla anterior que el saldo persistido coincida con el historial y que no existan cantidades comprometidas. Si la validación falla, la migración se detiene.

## Estado de implementación

| Elemento | Estado |
|---|---|
| Usuario | IMPLEMENTADO |
| Producto | IMPLEMENTADO |
| Lote | IMPLEMENTADO |
| Ubicacion | IMPLEMENTADO |
| Movimiento | IMPLEMENTADO |
| Cliente | PENDIENTE DE IMPLEMENTAR |
| Pedido | PENDIENTE DE IMPLEMENTAR |
| DetallePedido | PENDIENTE DE IMPLEMENTAR |
| lote_condicion_historial | IMPLEMENTADO como auditoría técnica |
| saldo_inventario | IMPLEMENTADO como vista derivada en la rama E3 |
| Existencia persistida | RETIRADA DEL MODELO ACTIVO en la rama E3 |

Los tres elementos pendientes pertenecen a los Must restantes de E3 y no se declararán implementados hasta contar con migración, API, pruebas y evidencia.

## Reglas de integridad

- Los saldos no se sobrescriben mediante un endpoint general.
- Cada movimiento tiene cantidad positiva.
- operacion_clave es única y protege la idempotencia.
- Los reintentos idénticos no duplican movimientos.
- Un traslado se serializa por lote y verifica saldo suficiente antes de registrar el movimiento.
- Un lote nuevo inicia RETENIDO.
- Solo el Administrador puede liberar, bloquear, ingresar o trasladar inventario administrativo.
- La baja de Producto es lógica.
- Ubicacion se mantiene parametrizable para permitir nuevas áreas o equipos sin modificar el código.

## Evidencia de regresión

Durante la migración, una ejecución real de QA falló porque pruebas E2E heredadas todavía consultaban la tabla Existencia retirada. La suite fue adaptada al saldo derivado y una ejecución posterior completó lint, compilación, pruebas unitarias y E2E correctamente. Esta secuencia se conservará como evidencia del apartado 2.8.

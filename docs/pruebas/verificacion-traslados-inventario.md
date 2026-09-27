# Verificación de traslados y movimientos de inventario

Fecha de verificación: 26/09/2026  
Issue: #19  
Rama: `desarrollo/traslados-inventario`

## Estado

**CONFIRMADO.** Implementé y comprobé el traslado transaccional de existencias entre ubicaciones físicas, el historial de movimientos y la interfaz web administrativa correspondiente.

La verificación automática utilizó PostgreSQL 18 en la base aislada `zav_test`. No utilicé Neon `production` para estas pruebas.

## Funcionalidad comprobada

El backend incorpora:

- `POST /api/v1/movimientos/traslado`;
- `GET /api/v1/movimientos?loteId=<uuid>`;
- validación de origen y destino diferentes;
- cantidad positiva;
- validación de ubicaciones físicas activas;
- control de saldo disponible;
- transacción atómica;
- idempotencia mediante `operacionClave`;
- historial con usuario, fecha, origen y destino;
- autorización exclusiva del Administrador en esta iteración.

La interfaz web incorpora:

- formulario de traslado;
- selección de lote;
- origen y destino;
- cantidad;
- referencia y motivo opcionales;
- mensaje de resultado;
- saldos actualizados por ubicación;
- consulta del historial del lote.

## Regla de condición del lote

Comprobé que un traslado **no cambia la condición del lote**.

En la prueba web el lote permaneció `RETENIDO` después de mover unidades desde Producción y Almacenamiento hacia Venta y Despacho.

Por lo tanto, la presencia física en `VENTA_DESPACHO` no se utiliza como autorización de venta.

La liberación del lote continúa pendiente de una iteración específica y no se declara implementada aquí.

## QA backend

Workflow: `QA backend`  
Ejecución: #15  
Commit: `de6c1e0f34e7f9437b9f73c7ecf77d4482aea8b3`  
Resultado: **success**

Ejecución:
https://github.com/RubenMealla/zav-sistema/actions/runs/36284238383

Resultados:

| Comprobación | Resultado |
| --- | --- |
| Lint | Aprobado |
| Build NestJS | Aprobado |
| Pruebas unitarias | 11/11 aprobadas |
| Pruebas E2E | 14/14 aprobadas |
| Artifact | `qa-backend-15` |

## Casos de traslado comprobados

Las pruebas E2E verificaron:

1. un Vendedor no puede registrar traslados y recibe HTTP 403;
2. un traslado válido descuenta el origen y aumenta el destino;
3. el mismo comando reenviado no duplica el movimiento;
4. reutilizar la misma clave con otros datos devuelve HTTP 409;
5. el lote continúa `RETENIDO`;
6. el traslado inverso funciona;
7. el historial contiene el ingreso inicial y los traslados;
8. un saldo insuficiente devuelve HTTP 409;
9. un saldo insuficiente no modifica existencias;
10. un saldo insuficiente no crea movimiento;
11. un fallo forzado al insertar el movimiento revierte los cambios de existencia.

## Rollback forzado

Para comprobar la atomicidad instalé temporalmente, únicamente dentro de `zav_test`, un trigger que genera el error controlado:

`FALLO_QA_TRASLADO`

El fallo ocurre después de que la operación ya intentó modificar las existencias y antes de persistir correctamente el movimiento.

Después del error comprobé que los saldos quedaron exactamente iguales a los valores anteriores y que no se creó un movimiento con la clave de la operación fallida.

El trigger y la función temporal se eliminan al finalizar la prueba.

## QA web con Playwright

Workflow: `QA web Playwright`  
Ejecución aprobada: #10  
Resultado: **success**  
Playwright: **2/2 pruebas aprobadas**  
Artifact: `qa-web-playwright-10`

Ejecución:
https://github.com/RubenMealla/zav-sistema/actions/runs/36284238354

La prueba administrativa completa comprobó:

1. acceso administrativo;
2. registro de producto;
3. registro de lote con 12 unidades en Producción y Almacenamiento;
4. persistencia después de recargar;
5. traslado de 5 unidades a Venta y Despacho;
6. saldo resultante de 7 unidades en Producción y Almacenamiento;
7. saldo resultante de 5 unidades en Venta y Despacho;
8. condición del lote todavía `RETENIDO`;
9. historial con el `INGRESO` y el `TRASLADO`;
10. persistencia de saldos e historial después de recargar.

## Evidencias visuales

El artifact `qa-web-playwright-10` contiene ocho capturas PNG:

1. `01-panel-protegido-sin-sesion.png`;
2. `02-acceso-administrativo.png`;
3. `03-panel-inventario.png`;
4. `04-producto-registrado.png`;
5. `05-lote-registrado.png`;
6. `06-persistencia-despues-recarga.png`;
7. `07-traslado-registrado.png`;
8. `08-traslado-persistente.png`.

Revisé las capturas 07 y 08. En ellas se observa el lote de prueba en condición `RETENIDO`, los saldos `PRODUCCION_ALMACENAMIENTO: 7` y `VENTA_DESPACHO: 5`, y el historial con el traslado de 5 unidades.

El artifact también conserva traces y el reporte HTML de Playwright.

## Fallo encontrado y corrección real

La ejecución Playwright #9 no fue aprobada.

Detectó dos problemas en la prueba:

- un selector de celda era ambiguo porque “Producción y Almacenamiento” aparecía en más de una fila del historial;
- el reintento reutilizaba códigos ya creados por el primer intento.

Corregí la prueba para:

- verificar origen y destino dentro de la fila específica de `TRASLADO`;
- utilizar códigos distintos según el número de reintento.

Después de la corrección, la ejecución #10 finalizó con **2/2 pruebas aprobadas**.

No oculté la ejecución fallida; forma parte de la trazabilidad real del QA.

## Límites del bloque

Este bloque no implementa todavía:

- liberación de lotes;
- salidas comerciales;
- compromiso de inventario por pedidos;
- consulta específica del Vendedor;
- distribución móvil;
- GPS.

Esas funciones deben tener sus propios requisitos, pruebas y evidencias antes de declararse confirmadas.

# ZAV 2026 — Condición comercial de lotes

**Estado:** CONFIRMADO EN RAMA mediante QA automático; pendiente de integración a `main` mediante Pull Request.  
**Issue:** #21.  
**Rama:** `desarrollo/liberacion-lotes`.

## Decisión

El sistema separa:

- **ubicación física:** dónde está el producto;
- **condición del lote:** si puede participar en disponibilidad comercial;
- **compromiso y salida:** cantidades asociadas a pedidos.

Un traslado físico no libera el lote.

## Estados

- `RETENIDO`: estado inicial de un lote nuevo.
- `LIBERADO`: lote habilitado para disponibilidad comercial, sujeto además a vigencia, producto activo, ubicación de venta y saldo.
- `BLOQUEADO`: lote excluido de disponibilidad comercial hasta una nueva decisión autorizada.

## Auditoría

Cada cambio de condición registra:

- clave idempotente;
- lote;
- condición anterior;
- condición nueva;
- Administrador responsable;
- motivo;
- fecha/hora.

La nueva tabla es `lote_condicion_historial`.

## Endpoints

### POST `/api/v1/lotes/:id/liberar`

Entrada:

```json
{
  "operacionClave": "UUID",
  "motivo": "Revision interna completada"
}
```

Reglas:

- solo Administrador;
- no permite liberar un lote vencido;
- no permite liberar un lote cuyo producto está inactivo;
- permite liberar desde `RETENIDO` o volver a liberar desde `BLOQUEADO`;
- la misma clave con los mismos datos es idempotente;
- la misma clave con otros datos responde `409`.

### POST `/api/v1/lotes/:id/bloquear`

Registra el cambio a `BLOQUEADO` con motivo obligatorio.

### GET `/api/v1/lotes/:id/condiciones`

Devuelve el historial paginado de cambios de condición.

## Disponibilidad comercial y salidas

En esta iteración no se crea todavía un endpoint general de disponibilidad comercial ni se implementa FEFO.

La regla que utilizará el módulo de pedidos queda definida para la siguiente iteración: un lote solo podrá participar en disponibilidad comercial cuando esté `LIBERADO`, no vencido, pertenezca a un producto activo y tenga saldo disponible en una ubicación habilitada para venta.

No se implementa una salida manual genérica. Las salidas se generarán desde pedidos/distribución para conservar la relación entre compromiso, retiro, entrega y retorno.

## Nota normativa

Esta liberación es una decisión de control del software. No se documentará como una obligación específica impuesta por SENASAG. Se adopta para mejorar trazabilidad y separar existencia física de disponibilidad comercial.


## QA confirmado en la rama

GitHub Actions sobre el commit `d8fd924ef45445e6c29b2e68e1dab6a71f3417ed`:

- backend: lint y build aprobados;
- pruebas unitarias: **11/11**;
- pruebas E2E: **20/20**;
- Playwright: **2/2**;
- artifact backend: `qa-backend-25`;
- artifact web: `qa-web-playwright-20`;
- diez capturas PNG generadas, incluidas `09-lote-liberado.png` y `10-lote-bloqueado.png`.

La evidencia detallada se registra en `docs/pruebas/verificacion-condicion-lotes.md`.

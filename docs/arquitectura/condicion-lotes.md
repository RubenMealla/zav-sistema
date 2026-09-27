# ZAV 2026 — Condición comercial de lotes

**Estado:** IMPLEMENTADO EN RAMA / PENDIENTE DE VALIDAR mediante QA.  
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

## Salidas comerciales

No se implementa una salida manual genérica. Las salidas se generarán desde pedidos/distribución para conservar la relación entre compromiso, retiro, entrega y retorno.

## Nota normativa

Esta liberación es una decisión de control del software. No se documentará como una obligación específica impuesta por SENASAG. Se adopta para mejorar trazabilidad y separar existencia física de disponibilidad comercial.

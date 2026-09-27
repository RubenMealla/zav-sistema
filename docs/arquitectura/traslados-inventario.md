# ZAV 2026 — Traslados de inventario

**Estado:** IMPLEMENTADO EN RAMA / PENDIENTE DE VALIDAR mediante QA automático.  
**Issue:** #19.  
**Rama:** `desarrollo/traslados-inventario`.

## Objetivo

Registrar traslados físicos de un lote entre ubicaciones activas de clase `AREA_FISICA` sin perder trazabilidad ni permitir saldos negativos.

El traslado **no cambia la condición del lote**. Un lote `RETENIDO` continúa `RETENIDO` después de moverse y no debe considerarse autorizado para venta solo por estar físicamente en una ubicación que permite venta.

## Contrato

### POST `/api/v1/movimientos/traslado`

Permiso actual: `ADMINISTRADOR`.

Entrada:

```json
{
  "operacionClave": "UUID generado para la operacion",
  "loteId": "UUID del lote",
  "origenCodigo": "PRODUCCION_ALMACENAMIENTO",
  "destinoCodigo": "VENTA_DESPACHO",
  "cantidad": 4,
  "referencia": "opcional",
  "motivo": "opcional"
}
```

Reglas:

- origen y destino deben ser diferentes;
- ambas ubicaciones deben estar activas y ser `AREA_FISICA`;
- la cantidad debe ser un entero positivo;
- el saldo trasladable es `cantidad_fisica - cantidad_comprometida`;
- si el saldo trasladable no alcanza, la API responde `409`;
- todas las actualizaciones y el movimiento se guardan dentro de una sola transacción;
- `operacionClave` evita duplicados por reintentos;
- reutilizar la misma clave con otros datos responde `409`;
- el traslado no libera ni bloquea el lote.

El diseño utiliza las ubicaciones configuradas en la base y no codifica únicamente un par fijo. Esto mantiene compatibilidad con futuras ubicaciones físicas que se agreguen al sistema.

### GET `/api/v1/movimientos?loteId=<uuid>&page=1&limit=20`

Permiso actual: `ADMINISTRADOR`.

Devuelve el historial paginado del lote con:

- tipo;
- cantidad;
- origen;
- destino;
- referencia;
- motivo;
- usuario;
- fecha/hora.

## Atomicidad

Para reducir conflictos concurrentes:

1. se bloquea la clave de operación;
2. se serializan movimientos del mismo lote durante la transacción;
3. se bloquean las filas de existencia involucradas;
4. se descuenta origen;
5. se incrementa o crea destino;
6. se registra el movimiento.

Si cualquiera de los pasos falla, la transacción debe revertir todos los cambios.

## Pendiente de validar

Antes de declarar este bloque CONFIRMADO se deben ejecutar pruebas reales de:

- traslado correcto;
- reintento idempotente;
- clave reutilizada con otros datos;
- saldo insuficiente;
- rol Vendedor sin permiso;
- traslado inverso;
- historial;
- rollback forzado después de modificar existencias;
- regresión de las pruebas anteriores.

No se declara implementada en este documento una regla de liberación de lotes ni una salida comercial.

# Verificación de liberación y bloqueo controlado de lotes

Fecha de verificación: 27/09/2026  
Issue: #21  
Rama: `desarrollo/liberacion-lotes`  
Commit verificado: `d8fd924ef45445e6c29b2e68e1dab6a71f3417ed`

## Estado

**CONFIRMADO EN RAMA.** Implementé y comprobé el cambio auditable de condición comercial de lotes. La integración a `main` queda pendiente del Pull Request y sus checks finales.

No utilicé Neon `production` para pruebas destructivas. GitHub Actions utilizó PostgreSQL 18 aislado en `zav_test`.

## Alcance comprobado

El backend incorpora:

- `POST /api/v1/lotes/:id/liberar`;
- `POST /api/v1/lotes/:id/bloquear`;
- `GET /api/v1/lotes/:id/condiciones`;
- tabla de auditoría `lote_condicion_historial`;
- responsable, fecha, motivo y condición anterior/nueva;
- idempotencia mediante `operacionClave`;
- autorización exclusiva del Administrador;
- rechazo de liberación de lote vencido;
- rechazo de liberación cuando el producto está inactivo;
- rollback si falla el registro de auditoría.

La interfaz web incorpora:

- formulario de cambio de condición;
- selección de lote;
- acción Liberar/Bloquear;
- motivo obligatorio;
- historial de cambios de condición;
- persistencia visible después de recargar.

## Decisión de diseño comprobada

Un traslado físico no cambia la condición comercial del lote.

La condición se administra de forma independiente:

`RETENIDO → LIBERADO → BLOQUEADO`

También se permite volver a liberar un lote bloqueado cuando el Administrador registra una nueva decisión válida.

Esta funcionalidad es una decisión de control del software ZAV 2026. No se presenta como una obligación normativa específica de SENASAG.

## QA backend

Workflow: `QA backend`  
Ejecución: #25  
Resultado: **success**

Ejecución:
https://github.com/RubenMealla/zav-sistema/actions/runs/36286045951

Resultados:

| Comprobación | Resultado |
| --- | --- |
| Lint | Aprobado |
| Build NestJS | Aprobado |
| Pruebas unitarias | 11/11 aprobadas |
| Pruebas E2E | 20/20 aprobadas |
| Artifact | `qa-backend-25` |

Las pruebas E2E incluyen la regresión de productos, lotes, permisos, traslados y los nuevos casos de condición.

## Casos de condición comprobados

Comprobé automáticamente:

1. liberación de un lote `RETENIDO`;
2. bloqueo de un lote `LIBERADO`;
3. nueva liberación desde `BLOQUEADO`;
4. registro de condición anterior, nueva, motivo, usuario y fecha;
5. reintento idempotente sin duplicar eventos;
6. reutilización de la misma clave con otros datos → `409`;
7. intento del Vendedor → `403`;
8. lote vencido no puede liberarse;
9. producto inactivo no permite liberar su lote;
10. fallo forzado de auditoría revierte el cambio de condición.

## Rollback forzado

Dentro de la base aislada `zav_test` se fuerza el error controlado `FALLO_QA_CONDICION`.

Después del fallo se comprueba que:

- la condición del lote conserva su valor anterior;
- no queda un evento de auditoría parcial.

Los fallos forzados de QA se ejecutan únicamente en el entorno aislado.

## QA web con Playwright

Workflow: `QA web Playwright`  
Ejecución: #20  
Resultado: **success**  
Playwright: **2/2 pruebas aprobadas**  
Artifact: `qa-web-playwright-20`

Ejecución:
https://github.com/RubenMealla/zav-sistema/actions/runs/36286045996

El flujo administrativo automatizado comprueba producto, lote, traslado, liberación, bloqueo y persistencia.

## Evidencias visuales

El artifact `qa-web-playwright-20` contiene diez capturas PNG:

1. `01-panel-protegido-sin-sesion.png`;
2. `02-acceso-administrativo.png`;
3. `03-panel-inventario.png`;
4. `04-producto-registrado.png`;
5. `05-lote-registrado.png`;
6. `06-persistencia-despues-recarga.png`;
7. `07-traslado-registrado.png`;
8. `08-traslado-persistente.png`;
9. `09-lote-liberado.png`;
10. `10-lote-bloqueado.png`.

Las capturas 09 y 10 son las evidencias visuales específicas que deben adjuntarse manualmente a la tarjeta de Trello **“Implementar inventario de productos terminados”** una vez cerrado el bloque.

## Límites de esta iteración

No implementé todavía:

- endpoint general de disponibilidad comercial;
- compromiso de stock por pedido;
- FEFO ejecutable;
- clientes y pedidos;
- retiro, entrega y retorno;
- distribución móvil;
- GPS.

Estas funciones continúan en iteraciones posteriores y no se declaran confirmadas aquí.

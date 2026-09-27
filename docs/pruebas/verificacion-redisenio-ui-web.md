# Verificación del rediseño de experiencia web — ZAV 2026

Fecha de verificación: 26/09/2026  
Issue: #23  
Rama: `desarrollo/redisenio-ui-web`  
Commit funcional verificado: `13949f1330a263b585d865138c3c83a6366287b0`

## Estado

**CONFIRMADO EN RAMA.**

Comprobé el rediseño con GitHub Actions, PostgreSQL 18 aislado, Playwright 1.63.0 y Chromium.

No utilicé Neon production para estas pruebas.

## QA backend

Workflow: `QA backend`  
Ejecución final de referencia en la rama: #41  
Resultado: **success**

Resultados:

| Comprobación | Resultado |
| --- | --- |
| Lint API | Aprobado |
| Build NestJS | Aprobado |
| Pruebas unitarias | 11/11 aprobadas |
| Pruebas E2E | 20/20 aprobadas |
| Artifact | `qa-backend-41` |

Ejecución:
https://github.com/RubenMealla/zav-sistema/actions/runs/36290730333

## QA web

Workflow: `QA web Playwright`  
Ejecución final de referencia en la rama: #36  
Resultado: **success**

Resultados:

| Comprobación | Resultado |
| --- | --- |
| Build API para entorno E2E | Aprobado |
| Lint web | Aprobado |
| Build Next.js | Aprobado |
| Playwright | 2/2 aprobadas |
| Artifact | `qa-web-playwright-36` |

Ejecución:
https://github.com/RubenMealla/zav-sistema/actions/runs/36290730351

## Flujo visual comprobado

Playwright comprobó:

1. página pública rediseñada;
2. protección de `/panel` sin sesión;
3. acceso administrativo;
4. dashboard;
5. navegación al módulo Productos;
6. apertura de modal;
7. registro de producto y notificación;
8. navegación a Lotes;
9. registro de lote;
10. navegación a Movimientos;
11. traslado y consulta de historial;
12. regreso a Lotes para comprobar saldos;
13. navegación a Condición de lotes;
14. liberación mediante modal;
15. historial de condición;
16. bloqueo mediante modal;
17. persistencia después de recargar;
18. regreso al dashboard.

## Evidencias visuales finales

El artifact `qa-web-playwright-36` contiene 11 capturas:

1. `01-inicio-redisenado.png`;
2. `02-acceso-protegido-redisenado.png`;
3. `03-dashboard-administrativo.png`;
4. `04-modal-producto.png`;
5. `05-producto-registrado.png`;
6. `06-lote-registrado.png`;
7. `07-traslado-registrado.png`;
8. `08-lote-liberado.png`;
9. `09-lote-bloqueado.png`;
10. `10-condicion-persistente.png`;
11. `11-dashboard-final.png`.

Revisé visualmente las capturas principales. La portada, el acceso, el dashboard, el modal y la vista de condición mantienen una misma identidad visual y los modales aparecen centrados sobre el contexto actual.

## Fallos detectados durante el QA

No oculté las ejecuciones fallidas.

En una ejecución anterior, Playwright detectó selectores demasiado generales:

- el selector `role=alert` también encontraba el anunciador de rutas de Next.js;
- el nombre de una ubicación aparecía en más de una fila del historial.

Corregí las pruebas para identificar el mensaje y la fila de traslado de forma específica.

En otra ejecución, el selector por etiqueta `Lote` coincidió también con otro `select` dentro del formulario de condición. Lo corregí utilizando los nombres de campo `loteId`, `accion` y `motivo`.

La ejecución final #36 terminó con **2/2 pruebas aprobadas**.

## Vercel Preview

El commit verificado `13949f1` recibió el estado oficial de GitHub:

- contexto: `Vercel`;
- estado: `success`;
- descripción: `Deployment has completed`.

Esto confirma que Vercel generó correctamente el deployment del commit de la rama.

## Limitaciones

Las pruebas actuales se ejecutan con Chromium de escritorio.

La interfaz tiene reglas responsive implementadas, pero una matriz específica de E2E para múltiples tamaños de pantalla puede añadirse cuando existan más módulos y antes del cierre integral del proyecto.

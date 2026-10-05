# Matriz de QA · E3

Estado: **IMPLEMENTADO EN RAMA DE PRUEBAS / PENDIENTE DE MERGE**  
Rama: `pruebas/e3-evidencias-http`

Esta matriz relaciona riesgo o requisito, nivel de prueba, precondición, resultado esperado y evidencia verificable. No sustituye los archivos de prueba; los referencia.

| ID | Requisito/riesgo | Nivel/tipo | Precondición/datos | Resultado esperado | Evidencia / estado |
|---|---|---|---|---|---|
| QA-SEC-001 | RF-02 / autenticación | API + seguridad | GET protegido sin Bearer | HTTP 401, formato común, sin datos internos | Playwright HTTP `http-401.png`; **PASS** |
| QA-SEC-002 | RF-03/RF-07 / autorización | API + seguridad | Administrador intenta ruta exclusiva del Vendedor | HTTP 403 | `http-403.png` + E2E pedidos; **PASS** |
| QA-VAL-001 | RF-07/RF-11 / validación | API | Cliente incompleto o coordenada fuera de rango | HTTP 400 | `http-400.png`; **PASS** |
| QA-NF-001 | Recursos inexistentes | API | UUID válido no existente | HTTP 404 | `http-404.png`; **PASS** |
| QA-CON-001 | RF-03/RF-08 / conflicto | API | Código de Producto duplicado / sobreventa / estado incompatible | HTTP 409 | `http-409.png` + E2E; **PASS** |
| QA-EXT-001 | Geocodificación | Integración externa | Geoapify no configurado en QA aislado | HTTP 503 genérico, sin clave | `http-503.png`; **PASS** |
| QA-INT-001 | Transaccionalidad | E2E backend | Trigger QA fuerza fallo al registrar movimiento | HTTP 500 y rollback: 0 lote, 0 movimiento | `permisos-inventario.e2e-spec.ts`; **PASS** |
| QA-FUN-001 | RF-03 | E2E + UI | Administrador autenticado | Crear/editar/desactivar Producto | Backend + Playwright; **PASS** |
| QA-FUN-002 | RF-04/RF-05 | E2E + UI | Producto/lote QA | Ingreso, traslado y condición auditables | Backend + Playwright; **PASS** |
| QA-FUN-003 | RF-08 | E2E backend | Vendedor, Cliente y stock disponibles | Pedido REGISTRADO y reserva disponibilidad | `pedidos-distribucion.e2e-spec.ts`; **PASS** |
| QA-FUN-004 | RF-10 | E2E backend | Pedido REGISTRADO | Retiro idempotente → EN_DISTRIBUCION | E2E individual/múltiple; **PASS** |
| QA-FUN-005 | RF-11 | E2E + Android | Pedido EN_DISTRIBUCION | Entrega con GPS puntual → ENTREGADO | E2E + validación física 04/10; **PASS** |
| QA-UI-001 | RNF-03/RNF-04 | UI web | Viewports 390, 768 y 1440 | Sin desborde horizontal; navegación visible | Playwright #484/#492; **PASS** |
| QA-UI-002 | RNF-03 | Accesibilidad | Teclado + reduced motion | Foco visible, trap de modal, contraste >= 4.5:1 | `identidad-teclado-contraste.png`; **PASS** |
| QA-UI-003 | Manejo de error | UI web | Credenciales inválidas | Mensaje legible; no oculta error | `identidad-acceso-error.png`; **PASS** |
| QA-MOB-001 | RNF-04 | Android | APK ZAV Vendedor 1.0.0 | Safe Area y navegación sin solaparse con barras del sistema | Validación física 04/10; **PASS** |
| QA-MOB-002 | RF-07 | Android | Vendedor autenticado | Cliente + selector de mapa + GPS foreground | Validación física 04/10; **PASS** |
| QA-MOB-003 | RF-08/RF-10/RF-11 | Android | Datos operativos QA | Pedido → retiro → entrega | Validación física 04/10; **PASS** |

## Criterio sobre HTTP 422

La plenaria P3 muestra **422 Unprocessable Entity** como alternativa válida para una regla de negocio violada. ZAV E3 no lo implementa actualmente: los conflictos de negocio/estado se modelan con **409**, mientras **400** se reserva para entrada inválida. No se simula un 422 inexistente; cualquier cambio futuro exige actualizar contrato, implementación y pruebas.

## Ejecuciones principales

- QA backend de cierre: run documentado del PR #35.
- QA web Playwright #492: 9/9 pruebas, artifact `qa-web-playwright-492`.
- Smoke público E3: salud pública + rechazo de credenciales inválidas + 401 sin token, sin almacenar credenciales válidas en el repositorio. La autenticación y autorización de ambos roles se verifican en las suites aisladas de QA.

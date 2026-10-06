# Matriz de QA · E3 · cierre del apartado 2.8

**Estado:** EJECUTADO Y VERIFICADO  
**Rama de cierre:** `pruebas/e3-qa-final-2-8`  
**PR:** #51  
**Datos de prueba:** sintéticos; no se versionan contraseñas reales, JWT ni secretos.

La matriz relaciona cada requisito o riesgo con su camino feliz, camino de error, nivel de prueba y evidencia reproducible. Los casos CP-01 a CP-21 se ejecutan en el workflow web con PostgreSQL aislado; CP-20 se acredita además mediante la suite E2E backend que fuerza un fallo transaccional; CP-22 usa capturas responsive reales; CP-23 combina QA estático, APK firmado y validación física documentada.

| ID | Requisito / riesgo | Nivel | Caso | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|---|
| CP-01 | RF-02 | API / seguridad | Login con credenciales válidas | HTTP 200 y sesión autenticada | PASS | `CP-01.png` · Playwright #651 |
| CP-02 | RF-02 | API / seguridad | Login con credenciales inválidas | HTTP 401, sin sesión | PASS | `CP-02.png` · Playwright #651 |
| CP-03 | Seguridad | API | Ruta protegida sin token | HTTP 401 | PASS | `CP-03.png` · Playwright #651 |
| CP-04 | Seguridad / roles | API | Administrador intenta ruta exclusiva del Vendedor | HTTP 403 | PASS | `CP-04.png` · Playwright #651 |
| CP-05 | RF-03 | API + UI | Crear, editar y dar de baja Producto | Persistencia y baja lógica correctas | PASS | `CP-05.png` + evidencia UI · Playwright #651 |
| CP-06 | RF-03 | API | Código de Producto duplicado | HTTP 409, sin duplicidad | PASS | `CP-06.png` · Playwright #651 |
| CP-07 | RF-04 | API | Registrar Lote e ingreso inicial | HTTP 201 y movimiento inicial | PASS | `CP-07.png` · Playwright #651 |
| CP-08 | RF-04 | API | Lote con cantidad inicial inválida | HTTP 400 | PASS | `CP-08.png` · Playwright #651 |
| CP-09 | RF-05 | API + integración | Traslado con saldo suficiente | HTTP 201; origen disminuye y destino aumenta | PASS | `CP-09.png` · Playwright #651 |
| CP-10 | RF-05 | API | Traslado superior al saldo | HTTP 409; operación no aplicada | PASS | `CP-10.png` · Playwright #651 |
| CP-11 | RF-06 | API / móvil | Registrar Cliente georreferenciado | HTTP 201 con coordenadas confirmadas | PASS | `CP-11.png` · Playwright #651 |
| CP-12 | RF-06 | API / validación | Cliente incompleto | HTTP 400 | PASS | `CP-12.png` · Playwright #651 |
| CP-13 | RF-07 | API / móvil | Registrar Pedido con disponibilidad | HTTP 201 y estado REGISTRADO | PASS | `CP-13.png` · Playwright #651 |
| CP-14 | RF-07 | API / negocio | Pedido superior a disponibilidad | HTTP 409; sin sobreventa | PASS | `CP-14.png` · Playwright #651 |
| CP-15 | RF-09 | API / móvil | Retirar Pedido | HTTP 201 y EN_DISTRIBUCION | PASS | `CP-15.png` · Playwright #651 |
| CP-16 | RF-09 | E2E / idempotencia | Repetir Retiro con la misma clave | No duplica movimiento ni descuento | PASS | `CP-16.png` + `pedidos-distribucion.e2e-spec.ts` |
| CP-17 | RF-10 | API / móvil | Confirmar entrega con GPS puntual | HTTP 201, ENTREGADO y georreferencia | PASS | `CP-17.png` · Playwright #651 |
| CP-18 | RF-10 | API / estado | Entregar antes del Retiro | HTTP 409 | PASS | `CP-18.png` · Playwright #651 |
| CP-19 | Contrato HTTP | API | UUID válido inexistente | HTTP 404 | PASS | `CP-19.png` · Playwright #651 |
| CP-20 | RF-04 / RF-05 | E2E / transacción | Fallo forzado durante ingreso | HTTP 500 y rollback completo | PASS | QA backend #609 · `permisos-inventario.e2e-spec.ts` |
| CP-21 | Integración externa | API | Geocodificación sin proveedor configurado en QA aislado | HTTP 503 genérico, sin clave | PASS | `CP-21.png` · Playwright #651 |
| CP-22 | RNF-03 / RNF-04 | UI web | 390, 768 y 1440 px | Sin desborde horizontal; navegación utilizable | PASS | capturas responsive · Playwright #651 |
| CP-23 | RNF-04 / móvil | Mobile / build / físico | ZAV Vendedor 1.0.0 | Lint/TS correctos, APK instalable y flujo físico aceptado | PASS | QA mobile #445 · APK #247 · `verificacion-app-movil-e3.md` |

## Resumen de ejecuciones de cierre

- **QA backend #609:** lint y build satisfactorios; 13/13 pruebas unitarias y 26/26 pruebas E2E en PostgreSQL 18 aislado.
- **QA web Playwright #651:** lint, build y 14/14 pruebas Playwright satisfactorias; artifact `qa-web-playwright-651`.
- **QA mobile #445:** `expo lint` y `tsc --noEmit` satisfactorios; artifact `qa-mobile-445`.
- **APK móvil E3 #247:** `BUILD SUCCESSFUL`; package `bo.zav.gestion.vendedor`, versión 1.0.0, versionCode 10000, firma v2 válida y SHA-256 generado.
- **Validación física:** ZAV Vendedor 1.0.0 fue aceptado en dispositivo Android el 4 de octubre de 2026, según `docs/pruebas/verificacion-app-movil-e3.md`.

## Criterio sobre HTTP 422

La plenaria P3 presenta 422 como una alternativa para reglas de negocio. ZAV no lo utiliza en su contrato actual: la entrada inválida responde 400 y los conflictos de negocio o estado responden 409. No se declara una respuesta 422 que no existe en la implementación.

## Trazabilidad de artifacts

Los artifacts de GitHub Actions conservan reportes, logs y capturas. Las credenciales sintéticas solo existen durante la ejecución aislada de CI y los JWT se omiten de las imágenes de evidencia.

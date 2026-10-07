# Matriz de QA · seguridad, API e interfaz web

**Estado:** EJECUTADO Y VERIFICADO  
**Rama de evidencia:** `pruebas/evidencias-qa-reales`  
**Issue de seguimiento:** #54  
**Datos de prueba:** sintéticos; no se versionan contraseñas reales, JWT ni secretos.

La matriz relaciona los requisitos funcionales y controles de seguridad con un camino correcto, un camino de error y una evidencia reproducible. La evidencia incorporada al documento corresponde a la API y a la aplicación web; las pruebas se ejecutan con PostgreSQL aislado para no alterar los datos del entorno desplegado.

| ID | Requisito / riesgo | Nivel | Caso | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|---|
| CP-01 | RF-02 | API / seguridad | Login con credenciales válidas | HTTP 200 y sesión autenticada | PASS | Swagger SW-13 |
| CP-02 | RF-02 | API / seguridad | Login con credenciales inválidas | HTTP 401, sin sesión | PASS | Swagger SW-04 + web acceso inválido |
| CP-03 | Seguridad | API / web | Ruta protegida sin token | HTTP 401 y retorno al acceso | PASS | Swagger SW-05 + web acceso protegido |
| CP-04 | Seguridad / roles | API | Usuario autenticado sin permiso | HTTP 403 | PASS | Swagger SW-06 |
| CP-05 | RF-03 | API + web | Crear, editar y dar de baja Producto | Persistencia y baja lógica correctas | PASS | Suite CRUD web + WEB-17 / WEB-19 |
| CP-06 | RF-03 | API | Código de Producto duplicado | HTTP 409, sin duplicidad | PASS | Swagger SW-07 |
| CP-07 | RF-04 | API + web | Registrar Lote e ingreso inicial | HTTP 201 y movimiento inicial | PASS | Swagger SW-14 + evidencia web de lote |
| CP-08 | RF-04 | API | Lote con cantidad inicial inválida | HTTP 400 | PASS | Swagger SW-20 |
| CP-09 | RF-05 | API + web | Traslado con saldo suficiente | HTTP 201; origen disminuye y destino aumenta | PASS | Swagger SW-15 + evidencia web de traslado |
| CP-10 | RF-05 | API + web | Traslado superior al saldo | HTTP 409; operación no aplicada | PASS | Swagger SW-21 + WEB-14 |
| CP-11 | RF-06 | API | Registrar Cliente georreferenciado | HTTP 201 con coordenadas confirmadas | PASS | Swagger SW-16 |
| CP-12 | RF-06 | API | Cliente incompleto | HTTP 400 | PASS | Swagger SW-22 |
| CP-13 | RF-07 | API | Registrar Pedido con disponibilidad | HTTP 201 y estado REGISTRADO | PASS | Swagger SW-17 |
| CP-14 | RF-07 | API | Pedido superior a disponibilidad | HTTP 409; sin sobreventa | PASS | Swagger SW-23 |
| CP-15 | RF-09 | API | Retirar Pedido | HTTP 201 y EN_DISTRIBUCION | PASS | Swagger SW-18 |
| CP-16 | RF-09 | E2E / idempotencia | Repetir Retiro con la misma clave | No duplica movimiento ni descuento | PASS | Swagger SW-25 + `pedidos-distribucion.e2e-spec.ts` |
| CP-17 | RF-10 | API | Confirmar entrega con GPS puntual | HTTP 201, ENTREGADO y georreferencia | PASS | Swagger SW-19 |
| CP-18 | RF-10 | API | Entregar antes del Retiro | HTTP 409 | PASS | Swagger SW-24 |
| CP-19 | Contrato HTTP | API | UUID válido inexistente | HTTP 404 | PASS | Swagger SW-08 |
| CP-20 | Integración externa | API | Geocodificación sin proveedor disponible en QA aislado | HTTP 503 genérico, sin exponer claves | PASS | Swagger SW-09 |
| CP-21 | RF-05 | E2E / idempotencia | Repetir Traslado con la misma clave | No duplica movimiento ni descuenta saldo dos veces | PASS | `permisos-inventario.e2e-spec.ts` |
| CP-22 | RF-04 | E2E / transacción | Fallo forzado durante ingreso | Rollback completo: sin lote ni movimiento parcial | PASS | `permisos-inventario.e2e-spec.ts` |
| CP-23 | Seguridad / validación doble | Web + API | Evadir la validación del navegador y enviar un código inválido | API responde HTTP 400 y la web presenta el error al usuario | PASS | WEB-20 · Playwright #761 |
| CP-24 | RNF web | UI web | 390, 768 y 1440 px | Sin desborde horizontal y navegación utilizable | PASS | Capturas responsive · Playwright #761 |

## Ejecución reproducible de referencia

- **QA web Playwright #761:** compilación de API y web, lint web, ejecución Playwright y conservación de capturas/reportes; resultado **success**.
- **Commit:** `c41c7fd1183abbee361798881d6ec1541b0a936a`.
- **Evidencia web específica:** `WEB-20-error-validacion-400.png` demuestra la validación doble: se evita deliberadamente la restricción HTML del navegador, el backend rechaza el dato con HTTP 400 y la interfaz presenta el error.
- Las suites E2E del backend comprueban 401/403, CRUD, idempotencia, transacciones y rollback sobre PostgreSQL aislado.

## Criterio sobre HTTP 422

El contrato actual de ZAV utiliza HTTP 400 para datos de entrada inválidos y HTTP 409 para conflictos de negocio o de estado. No se documenta una respuesta 422 que no forma parte de la implementación.

## Trazabilidad

Los reportes, logs y capturas de GitHub Actions permiten revisar la ejecución sin exponer contraseñas, JWT ni claves de servicio. Los intentos y correcciones permanecen en el historial para conservar la evolución real del proyecto.

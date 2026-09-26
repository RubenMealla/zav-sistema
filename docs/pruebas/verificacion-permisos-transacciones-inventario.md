# Verificación de permisos y transacciones de inventario

Fecha de verificación: 26/09/2026  
Rama: `desarrollo/permisos-transacciones-inventario`

## Estado

**CONFIRMADO.** Comprobé los casos definidos en la Issue #14 mediante una combinación de ejecución manual contra el entorno desplegado de desarrollo y pruebas automáticas en GitHub Actions con una base PostgreSQL aislada.

No utilicé credenciales de producción ni modifiqué la rama `production` de Neon durante las pruebas automáticas.

## Cuenta Vendedor de desarrollo

Creé la cuenta de desarrollo `vendedor.pruebas` con rol `VENDEDOR` en la base de datos de la rama `development` de Neon.

La existencia de la cuenta fue comprobada consultando únicamente `identificador`, `rol` y `activo`; no se leyó ni registró la contraseña ni su hash como evidencia.

Resultado confirmado:

| Comprobación | Resultado |
| --- | --- |
| Rol almacenado | `VENDEDOR` |
| Cuenta activa | Sí |
| Contraseña registrada en documentación | No |

## Verificación manual contra la API desplegada

Ejecuté las solicitudes contra `https://zav-api-2026.onrender.com` utilizando la cuenta `vendedor.pruebas`.

Resultados obtenidos:

| Solicitud | Resultado |
| --- | ---: |
| `GET /api/v1/auth/me` | HTTP 200 |
| `GET /api/v1/productos` | HTTP 403 |
| `GET /api/v1/lotes` | HTTP 403 |
| `POST /api/v1/productos` | HTTP 403 |
| `POST /api/v1/lotes` | HTTP 403 |

Estos resultados corresponden al contrato actual de E2: productos y lotes son rutas administrativas. La consulta de inventario autorizada para el Vendedor corresponde a una iteración posterior y no se declara implementada en esta evidencia.

## Pruebas automáticas

Configuré GitHub Actions para ejecutar la API con PostgreSQL 18 en un contenedor aislado. La preparación E2E contiene una protección que rechaza cualquier `DATABASE_URL` que no apunte a `localhost` o `127.0.0.1` y a la base `zav_test`.

Ejecución verificada:

- Workflow: `QA backend`
- Ejecución: #1
- Commit: `c13acba94037d303e3f830a81891012943c74239`
- Resultado global: **success**
- Pruebas unitarias: **11 aprobadas de 11**
- Pruebas E2E: **9 aprobadas de 9**
- Artifact generado: `qa-backend-1`
- URL de ejecución: https://github.com/RubenMealla/zav-sistema/actions/runs/36277702943

La ejecución también verificó `lint` y compilación antes de ejecutar las pruebas.

## Casos E2E comprobados

Las pruebas automáticas confirmaron:

1. autenticación de una cuenta `VENDEDOR` y lectura de su rol mediante `/auth/me`;
2. respuesta HTTP 401 para una solicitud sin autenticación;
3. respuesta HTTP 403 para un Vendedor que intenta registrar productos;
4. respuesta HTTP 403 para un Vendedor que intenta registrar lotes;
5. ausencia de nuevas filas cuando el Vendedor intenta esas altas;
6. registro válido de producto y rechazo de datos inválidos y código duplicado;
7. registro válido de lote, rechazo de fechas inválidas e idempotencia de `operacionClave`;
8. rollback de la transacción cuando se fuerza un fallo antes de insertar la existencia;
9. persistencia de producto, lote y existencia después de cerrar y volver a iniciar la aplicación NestJS.

## Verificación del rollback

Para comprobar el rollback forcé un error únicamente dentro de la base temporal `zav_test`. La prueba instaló de forma temporal un trigger sobre `existencia` que lanzó el error controlado `FALLO_QA_FORZADO`.

Después de recibir HTTP 500 comprobé que:

| Registro relacionado con la operación fallida | Cantidad persistida |
| --- | ---: |
| Lote | 0 |
| Movimiento | 0 |
| Existencia | 0 |

El trigger y la función usados para provocar el error fueron eliminados al finalizar la prueba.

Por lo tanto, el fallo entre la creación del lote, el movimiento y la existencia no dejó información parcial persistida.

## Manejo de errores y datos sensibles

Comprobé que la respuesta HTTP del fallo forzado no contiene:

- `DATABASE_URL`;
- la contraseña de la cuenta administrativa de prueba;
- el campo `contrasena_hash`.

Las credenciales incluidas en el workflow son valores sintéticos destinados exclusivamente al contenedor temporal de QA y no corresponden a cuentas de Neon, Render o Vercel.

## Evidencias disponibles

La trazabilidad queda registrada en:

- Issue #14;
- rama `desarrollo/permisos-transacciones-inventario`;
- commits de la rama;
- workflow `QA backend`;
- logs de GitHub Actions;
- artifact `qa-backend-1`;
- este documento.

Las capturas visuales con Playwright se incorporarán posteriormente en el bloque de QA de la interfaz web; no forman parte de esta comprobación de backend.

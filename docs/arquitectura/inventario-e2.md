# ZAV 2026 — Endpoints mínimos de productos y lotes (E2)

**Estado:** código preparado para ejecutar y verificar; no afirmar que el alta funciona hasta completar las pruebas en Neon `development`. La cuenta de Administrador ya se creó en `development` y el inicio de sesión básico fue probado en el entorno local.

## API REST

- `POST /api/v1/productos`: `codigo`, `nombre`, `familia`, `presentacion`, `pesoGramos` (entero positivo) y `precioBob` (importe decimal, preferiblemente cadena, por ejemplo `"25.50"`). Crea producto activo, `201`. Código repetido: `409`.
- `GET /api/v1/productos`: admite `q`, `activo=true|false`, `page` y `limit`; respuesta `{items,total,page,limit}`.
- `GET /api/v1/productos/:id`: UUID y producto completo; `404` si no existe.
- `POST /api/v1/lotes`: `operacionClave` (UUID), `productoId` (UUID), `codigo`, `elaboradoEl` y `venceEl` (YYYY-MM-DD), `cantidadInicial` (entero positivo), `ubicacionCodigo=PRODUCCION_ALMACENAMIENTO`. Crea lote **RETENIDO**, movimiento de ingreso y existencia en la misma transacción; `201`.
- `GET /api/v1/lotes`: admite `productoId`, `vigencia=vigente|vencido`, `page` y `limit`; retorna lotes y saldos por ubicación.
- `GET /api/v1/lotes/:id`: detalle del lote con producto y existencias; `404` si no existe.

Todas las rutas mencionadas requieren token de acceso vigente de un `ADMINISTRADOR`. Un Vendedor autenticado obtiene `403`; sin token, `401`. No se crean ni alteran tablas automáticamente. La ubicación de ingreso inicial debe existir y estar activa.

## Idempotencia y trazabilidad

`operacionClave` identifica un intento lógico de ingresar un lote. Para reintentar **el mismo** ingreso, reutilizar su UUID. La transacción bloquea reintentos simultáneos con esa clave, devuelve el lote ya creado si todos los datos coinciden y rechaza con `409` si se reutiliza la clave con otros datos. No sumar saldo en una ruta independiente. Para **un ingreso nuevo**, generar una nueva clave UUID. La comparación de reintentos exige el mismo Administrador.

El servidor comprueba fechas, códigos, cantidades y existencia del producto. Los lotes quedan `RETENIDO` y no pueden usarse para ventas. El cambio a `LIBERADO` sigue pendiente para una iteración posterior y no forma parte de esta actualización. Por tanto, los saldos mostrados son físicos, **no disponibilidad comercial**.

## Verificación pendiente antes de hacer commit

1. Ejecutar `build`, `lint`, `test` y `test:e2e` en el entorno local.
2. Con el JWT del Administrador, probar alta y consulta de un producto de demostración y de un lote de demostración en Neon `development`.
3. Reenviar el **mismo cuerpo de lote** con la misma `operacionClave`; el saldo y el número de movimientos deben quedar iguales.
4. Repetir con la misma clave y otro contenido: `409`. Probar también fechas imposibles, cantidad cero, código repetido y solicitud sin token (`400`, `409` o `401` según corresponda).
5. Consultar el lote y su existencia tras reiniciar la API. Comprobar permisos de Vendedor (`403`) cuando exista una cuenta de prueba de ese rol.
6. Guardar evidencias de pruebas con datos de demostración, sin imprimir contraseña, token ni cadena de conexión.

Nota: las pruebas unitarias incluidas con esta actualización cubren validación de entradas. No reemplazan las pruebas de integración anteriores ni las que deben realizarse sobre una transacción real en PostgreSQL.

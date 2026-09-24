# ZAV 2026 — Contrato mínimo API REST para E2

**Estado:** diseño; aún no implementado. **Versión:** `/api/v1`. **Formato:** JSON (`Content-Type: application/json`); errores uniformes con `statusCode`, `message`, `error`, `path` y `timestamp` cuando se implemente el filtro de excepciones. No exponer hash de contraseña ni secretos.

## 1. Autorización y validación

- La autenticación interna se implementará en NestJS mediante identificador y contraseña, JWT (JSON Web Token) de acceso de duración limitada y autorización RBAC por roles `ADMINISTRADOR` y `VENDEDOR`. La contraseña se almacenará como hash con Argon2id, nunca en texto claro. Antes de ejecutar una operación protegida, la API verificará la firma y expiración del JWT, la vigencia de la cuenta y sus permisos. No añadir credenciales reales ni secretos de firma al repositorio. La revocación anticipada y renovación de sesiones requieren un mecanismo adicional: un JWT emitido no se invalida por el simple cierre de sesión local.
- `ADMINISTRADOR`: web y móvil; puede crear y consultar productos y lotes, y registrar el ingreso inicial. `VENDEDOR`: móvil; permisos de consulta de inventario y gestión de pedidos en iteración posterior. La API comprueba permisos independientemente de la plataforma que envía la solicitud.
- Validación de entrada en el backend: tipos, longitudes, enteros positivos, fechas válidas, códigos únicos y estado de producto. Los parámetros de consulta inválidos responden `400`; no se convierte un error de cliente en un `500`.
- Códigos comunes: `400` entrada inválida; `401` no autenticado/credenciales incorrectas; `403` sin permiso; `404` recurso inexistente; `409` duplicidad o conflicto de estado/disponibilidad; `500` error inesperado controlado y registrado sin revelar credenciales.

## 2. Endpoints para E2

| Método | Ruta | Permiso | Entrada esencial | Éxito | Errores mínimos |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Público | `identificador`, `contrasena` | 200 JWT de acceso, expiración y perfil no sensible | 400, 401 |
| GET | `/api/v1/auth/me` | Autenticado | JWT vigente en encabezado `Authorization: Bearer ...` | 200 identificador, nombre, rol | 401 |
| GET | `/api/v1/productos` | Administrador | `q`, `activo`, `page`, `limit` opcionales | 200 resultados paginados | 400, 401, 403 |
| POST | `/api/v1/productos` | Administrador | `codigo`, `nombre`, `familia`, `presentacion`, `pesoGramos`, `precioBob` | 201 producto creado | 400, 401, 403, 409 |
| GET | `/api/v1/productos/:id` | Administrador | UUID de producto | 200 producto | 400, 401, 403, 404 |
| GET | `/api/v1/lotes` | Administrador | `productoId`, `vigencia`, `page`, `limit` opcionales | 200 lotes y saldos por área | 400, 401, 403 |
| POST | `/api/v1/lotes` | Administrador | `operacionClave`, `productoId`, `codigo`, `elaboradoEl`, `venceEl`, `cantidadInicial`, `ubicacionCodigo` | 201 lote `RETENIDO`, ingreso y saldo físico persistidos juntos | 400, 401, 403, 404, 409 |
| GET | `/api/v1/lotes/:id` | Administrador | UUID de lote | 200 lote, producto y existencias | 400, 401, 403, 404 |

`POST /lotes` es un **comando de registro de lote con ingreso inicial**, no dos operaciones independientes; protege la unicidad mediante `operacionClave`, un UUID generado al iniciar la acción de guardar (y reutilizado solo en sus reintentos). El servidor debe devolver el mismo resultado ante reenvío del mismo comando; si un comando con esa clave cambia de contenido, responder `409`. El lote creado queda en condición `RETENIDO`, aunque su existencia física se registre; esto impide considerarlo apto para compromisos comerciales antes de una liberación autorizada. Nunca incluir la clave de conexión a Neon en solicitudes de frontend.

Ejemplo únicamente estructural de entrada para `POST /api/v1/lotes` (los valores no describen operaciones reales de ZAV):

```json
{
  "operacionClave": "11111111-1111-4111-8111-111111111111",
  "productoId": "22222222-2222-4222-8222-222222222222",
  "codigo": "LOTE-EJEMPLO-001",
  "elaboradoEl": "2026-09-23",
  "venceEl": "2026-10-23",
  "cantidadInicial": 20,
  "ubicacionCodigo": "PRODUCCION_ALMACENAMIENTO"
}
```

## 3. Contratos que se documentarán antes de la siguiente iteración

- `PATCH /api/v1/productos/:id`: modificación de campos comerciales sin alterar lotes históricos.
- `POST /api/v1/lotes/:id/liberacion`: el Administrador registra revisión y autoriza el cambio de condición `RETENIDO` a `LIBERADO`, conservando responsable, fecha y constancia. No genera nuevo ingreso ni incrementa saldos. **Operación posterior al flujo mínimo del E2**; hasta entonces los lotes nuevos no son aptos para confirmar pedidos.
- `GET /api/v1/inventario`: saldos por lote/área, disponibilidad comercial y vencimiento; vendedor solo consulta lo autorizado de Venta y Despacho.
- `POST /api/v1/movimientos/traslado`: origen, destino, lote, cantidad y clave idempotente; transacción atómica.
- `POST /api/v1/clientes`, `GET /api/v1/clientes` y `POST /api/v1/pedidos`: cliente, líneas comerciales, confirmación y asignación FEFO separadas.
- `POST /api/v1/pedidos/:id/retiro`, `POST /api/v1/pedidos/:id/entrega`, `POST /api/v1/pedidos/:id/no-entregado` y `POST /api/v1/pedidos/:id/retorno`: conservar custodia y no descontar dos veces.
- `GET /api/v1/pedidos`: filtros por estado/fecha y visibilidad por rol; `GET /api/v1/usuarios` y otras rutas administrativas de cuentas cuando se implementen.

## 4. Pruebas E2 y evidencias

| Caso | Comprobación |
|---|---|
| Inicio de sesión correcto e incorrecto | Acceso con credenciales válidas; `401` con inválidas; sin revelar si existe la cuenta. |
| Vendedor intenta `POST /productos` o `POST /lotes` | `403`, sin filas nuevas. |
| Producto duplicado o datos comerciales inválidos | `409` o `400`, respectivamente. |
| Lote con vencimiento inválido o sin cantidad | `400`, sin ingreso parcial. |
| Reenvío del ingreso inicial | No se duplica el movimiento ni la existencia. |
| Registro inicial de lote | Respuesta y persistencia con condición `RETENIDO`, sin autorizar su venta por defecto. |
| Liberación posterior | Requiere autorización y no modifica cantidades; prueba pendiente hasta implementar la operación. |
| Consulta después de reiniciar el servidor | Producto, lote e ingreso persisten en PostgreSQL. |
| Uso desde web desplegada | Login y alta de producto/lote funcionan contra API desplegada y BD remota; capturas con datos de demostración. |

**Nota de trazabilidad:** los RF-05, RF-08, RF-10 y RF-11 exigen contratos y pruebas más amplios. Este documento describe las rutas mínimas de E2 y no se debe usar como evidencia de que los módulos posteriores funcionan.

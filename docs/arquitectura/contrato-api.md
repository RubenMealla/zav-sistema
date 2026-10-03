# ZAV 2026 — Contrato API REST · E3

**Versión:** `/api/v1`. **Formato:** JSON.  
**Estado:** inventario desplegado; backend de Cliente, Pedido, Retiro y Entrega verificado por QA en la rama E3 y pendiente de despliegue.

## 1. Reglas comunes

- Autenticación con JWT Bearer de 15 minutos.
- Contraseñas con Argon2id.
- Roles: `ADMINISTRADOR` y `VENDEDOR`.
- La autorización se verifica en NestJS; no depende de ocultar controles en la interfaz.
- Errores con formato común: `statusCode`, `error`, `message`, `path`, `timestamp`.
- Respuestas esperadas: `400` entrada inválida; `401` sin autenticación; `403` rol incorrecto; `404` recurso inexistente; `409` conflicto de estado, idempotencia o disponibilidad; `500` error interno sin detalles sensibles.
- Fechas de eventos se almacenan como `TIMESTAMPTZ`; fechas de elaboración/vencimiento como `DATE`.
- Los UUID de operación deben reutilizarse únicamente al reintentar la misma acción.

## 2. Autenticación y salud

| Método | Ruta | Rol | Entrada | Éxito |
|---|---|---|---|---|
| GET | `/api/v1/salud` | Público | — | 200 `{"estado":"ok"}` |
| POST | `/api/v1/auth/login` | Público | `identificador`, `contrasena` | 200 token y perfil |
| GET | `/api/v1/auth/me` | Autenticado | Bearer token | 200 perfil |

## 3. Administración web

| Método | Ruta | Rol | Propósito |
|---|---|---|---|
| GET | `/api/v1/productos` | Administrador o Vendedor | Consultar productos; Vendedor solo lectura |
| POST | `/api/v1/productos` | Administrador | Alta |
| GET | `/api/v1/productos/:id` | Administrador o Vendedor | Consulta individual |
| PATCH | `/api/v1/productos/:id` | Administrador | Edición |
| PATCH | `/api/v1/productos/:id/baja` | Administrador | Baja lógica |
| GET / POST | `/api/v1/lotes` | Administrador | Consulta / ingreso inicial |
| GET | `/api/v1/lotes/:id` | Administrador | Detalle y saldos |
| POST | `/api/v1/lotes/:id/liberar` | Administrador | Liberación auditable |
| POST | `/api/v1/lotes/:id/bloquear` | Administrador | Bloqueo auditable |
| GET | `/api/v1/lotes/:id/condiciones` | Administrador | Historial |
| POST | `/api/v1/movimientos/traslado` | Administrador | Traslado idempotente |
| GET | `/api/v1/movimientos?loteId=...` | Administrador | Historial de movimientos |

Un traslado que retire stock liberado y vigente desde `VENTA_DESPACHO` responde `409` si reduciría la cobertura de pedidos registrados. El bloqueo de un lote aplica la misma protección.

## 4. Vendedor móvil

| Método | Ruta | Rol | Entrada esencial | Éxito | Error de negocio |
|---|---|---|---|---|---|
| POST | `/api/v1/clientes` | Vendedor | `nombre`, `direccion`; `telefono` opcional | 201 Cliente | 400 |
| GET | `/api/v1/clientes` | Vendedor | `q`, `page`, `limit` | 200 paginado | 400 |
| GET | `/api/v1/clientes/:id` | Vendedor | UUID | 200 Cliente | 404 |
| GET | `/api/v1/pedidos/disponibilidad` | Vendedor | — | 200 productos y disponibilidad | — |
| POST | `/api/v1/pedidos` | Vendedor | `clienteId`, `detalles[]`, dirección/observación opcionales | 201 Pedido REGISTRADO | 400, 404, 409 |
| GET | `/api/v1/pedidos` | Vendedor | `estado`, `page`, `limit` | 200 solo pedidos propios | 400 |
| GET | `/api/v1/pedidos/:id` | Vendedor | UUID | 200 Pedido propio | 404 |
| POST | `/api/v1/pedidos/:id/retiro` | Vendedor | `operacionClave` | 201 EN_DISTRIBUCION | 404, 409 |
| POST | `/api/v1/pedidos/:id/entrega` | Vendedor | `operacionClave`, `latitud`, `longitud` | 201 ENTREGADO | 400, 404, 409 |

### Creación de pedido

El servidor bloquea lógicamente por Producto durante la comprobación de disponibilidad. La disponibilidad se calcula desde `saldo_inventario` menos cantidades de pedidos `REGISTRADO`. Cada detalle conserva el precio unitario del Producto al crear el pedido.

### Retiro

El retiro exige estado `REGISTRADO`, pertenece al mismo Vendedor y asigna lotes FEFO liberados/vigentes en `VENTA_DESPACHO`. Crea movimientos `RETIRO` hacia `EN_DISTRIBUCION` y cambia el pedido a `EN_DISTRIBUCION`. Repetir la misma clave no duplica movimientos.

### Entrega

La entrega exige `EN_DISTRIBUCION`, valida latitud [-90,90] y longitud [-180,180], crea movimientos `ENTREGA` con salida desde `EN_DISTRIBUCION`, registra fecha/hora y coordenadas puntuales y cambia a `ENTREGADO`. No existe seguimiento GPS continuo.

## 5. Casos automatizados verificados

La ejecución QA backend `37100513647` comprobó lint sin advertencias, build correcto, 11 pruebas unitarias y 18 E2E. La suite de pedidos contiene siete casos: rol incorrecto/validación de Cliente, registro de Cliente, consulta de Producto/disponibilidad, reserva y sobreventa, transición/GPS inválidos, protección de stock administrativo y flujo Pedido → Retiro → Entrega con reintentos idempotentes.

La ejecución previa `37100404491` falló por una dependencia faltante de `JwtAuthGuard` en `PedidosModule`. Se conserva como evidencia de incidencia y regresión.

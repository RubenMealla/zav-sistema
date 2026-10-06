# Matriz de alertas y confirmaciones — ZAV 2026

**Estado:** IMPLEMENTADO en `mejora/ui-web-consolidada`.

## Criterio

- Toda operación que modifica datos informa resultado de éxito o error.
- Las acciones sensibles o difíciles de revertir requieren confirmación previa.
- Navegación, filtros, paginación, apertura de detalles y búsquedas no requieren confirmación porque no modifican datos.
- Cuando el error proviene de la API se muestra el código HTTP junto con una explicación para el usuario.
- Cuando no existe respuesta HTTP se muestra `SIN RESPUESTA HTTP`.
- Las validaciones locales no reciben un código HTTP ficticio: se identifican como validación o se explican directamente antes de enviar la solicitud.
- El detalle mostrado al usuario se limita al campo `message` controlado por la API; no se muestran stack traces, secretos ni información sensible.

## Web administrativa

| Operación | Confirmación | Éxito | Error |
| --- | --- | --- | --- |
| Inicio de sesión Administrador | No, es la acción solicitada | Toast al entrar al panel | Código/causa en acceso |
| Cierre de sesión | Sí | Aviso al volver al acceso | No aplica a petición remota |
| Registrar producto | Sí | Toast | HTTP + explicación API |
| Editar producto | Sí | Toast | HTTP + explicación API |
| Desactivar producto | Sí, acción sensible | Toast | HTTP + explicación API |
| Registrar lote e ingreso | Sí | Toast | HTTP + explicación API |
| Liberar/bloquear lote | Sí | Toast | HTTP + explicación API |
| Registrar traslado | Sí | Toast | HTTP + explicación API |
| Guardar georreferencia de despacho | Sí | Toast | HTTP/VALIDACIÓN + explicación |
| Carga de productos/lotes/movimientos/condiciones/pedidos/distribución | No modifica datos | No requiere éxito | Aviso HTTP si la vista queda incompleta |
| Sugerir código de producto/lote | No modifica datos | Campo actualizado | HTTP o SIN RESPUESTA HTTP en ayuda |
| Buscar dirección | No modifica datos | Lista/mapa actualizados | HTTP o SIN RESPUESTA HTTP |

## Aplicación móvil Vendedor

| Operación | Confirmación | Éxito | Error |
| --- | --- | --- | --- |
| Inicio de sesión | No | Cambio a sesión Vendedor | HTTP + explicación |
| Cierre de sesión | Sí | Retorno al acceso | Local |
| Registrar cliente | No destructiva | Notificación | HTTP + explicación |
| Editar cliente | No destructiva | Notificación | HTTP + explicación |
| Desactivar/reactivar cliente | Sí | Notificación | HTTP + explicación |
| Registrar pedido | No destructiva | Notificación | HTTP + explicación |
| Corregir pedido | No destructiva | Notificación | HTTP + explicación |
| Anular pedido | Sí, acción sensible | Notificación | HTTP + explicación |
| Retirar pedido | Sí | Notificación | HTTP + explicación |
| Retirar seleccionados | Sí | Notificación | HTTP + explicación |
| Confirmar entrega | Sí, después de captura puntual de GPS | Notificación | HTTP + explicación |
| Organizar recorrido | No destructiva | Notificación | HTTP + explicación |
| Recalcular/agregar al recorrido | No destructiva | Notificación | HTTP + explicación |
| Buscar/confirmar ubicación de cliente | Confirmación del punto dentro del flujo | Actualización visual | HTTP cuando la API responde con error; mensaje local para GPS/permisos |

## Códigos mostrados

Ejemplos de etiquetas visibles:

- `HTTP 400`: solicitud inválida.
- `HTTP 401`: sesión no válida/no autenticada.
- `HTTP 403`: permiso insuficiente.
- `HTTP 404`: recurso inexistente.
- `HTTP 409`: conflicto de negocio o duplicado.
- `HTTP 500` / `HTTP 503`: error del servicio.
- `SIN RESPUESTA HTTP`: no hubo respuesta de la API/servicio.
- `VALIDACIÓN`: dato rechazado antes de enviar la solicitud.
- `ERROR LOCAL`: problema del dispositivo o de una operación local sin respuesta HTTP.
- `SIN RESULTADOS`: consulta válida que no devolvió coincidencias.
- `ROL NO PERMITIDO`: la sesión es válida, pero corresponde a una aplicación/rol distinto.

El código no reemplaza el mensaje legible: ambos se muestran juntos para facilitar soporte, demostración y defensa.

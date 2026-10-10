# Índice de evidencias web y API utilizadas en el documento

Este archivo relaciona las capturas conservadas por la ejecución automatizada de pruebas con la función que demuestran. Las imágenes corresponden a una base PostgreSQL separada para pruebas y no modifican los datos del entorno público.

## Ejecución de referencia

- GitHub Actions: **QA web Playwright #765**
- Commit ejecutado: `e386dfa18207ef8b4f60d05a58a5f86821f6f184`
- Resultado: **success**
- Reporte HTML y capturas: incluidos en la evidencia descargable de la ejecución.

## Interfaz web

| Evidencia | Función | Camino | Qué demuestra |
|---|---|---|---|
| `identidad-acceso-1440.png` | Acceso | Formulario | Campos de identificador y contraseña y acceso restringido. |
| `03-dashboard-administrativo.png` | Acceso | Correcto | Sesión de Administrador y panel cargado. |
| `identidad-acceso-error.png` | Acceso | Error | Credenciales inválidas informadas al usuario. |
| `WEB-23-vendedor-web-403.png` | Roles | Error | Un Vendedor autenticado no puede ingresar al panel administrativo; HTTP 403 visible. |
| `identidad-modal-productos-1440.png` | Producto | Formulario | Campos y validaciones del registro de Producto. |
| `WEB-15-confirmacion-producto.png` | Producto | Confirmación | Confirmación explícita antes de guardar. |
| `WEB-13-producto-registrado-limpio.png` | Producto | Correcto | Producto registrado y visible en la tabla. |
| `WEB-20-error-validacion-400.png` | Producto | Error | Dato inválido rechazado por la API; HTTP 400 visible en la web. |
| `WEB-17-producto-editado.png` | Producto | Correcto | Edición desde la interfaz y mensaje de éxito. |
| `WEB-19-producto-desactivado.png` | Producto | Correcto | Baja lógica; Producto permanece como INACTIVO. |
| `identidad-modal-lotes-1440.png` | Lote | Formulario | Registro de lote, fechas, cantidad e ingreso inicial. |
| `06-lote-registrado.png` | Lote | Correcto | Lote registrado RETENIDO y existencia inicial visible. |
| `WEB-21-error-lote-fecha-400.png` | Lote | Error | Fecha de elaboración futura rechazada; HTTP 400 visible. |
| `identidad-modal-movimientos-1440.png` | Traslado | Formulario | Lote, cantidad, origen, destino y referencia. |
| `WEB-16-confirmacion-traslado.png` | Traslado | Confirmación | Confirmación explícita antes del movimiento. |
| `07-traslado-registrado.png` | Traslado | Correcto | Traslado registrado y visible en el historial. |
| `WEB-14-error-traslado-409.png` | Traslado | Error | Saldo insuficiente rechazado; HTTP 409 visible. |
| `identidad-modal-condiciones-1440.png` | Condición de lote | Formulario | Selección de lote, acción y motivo. |
| `08-lote-liberado.png` | Condición de lote | Correcto | Liberación registrada y notificada. |
| `WEB-22-error-condicion-409.png` | Condición de lote | Error | Liberación repetida rechazada; HTTP 409 visible. |
| `09-lote-bloqueado.png` | Condición de lote | Correcto | Bloqueo registrado con motivo. |
| `11-distribucion-mapa.png` | Distribución | Correcto | Mapa administrativo de Venta y Despacho. |
| `identidad-pedidos-1440.png` | Pedidos | Consulta | Filtros y auditoría administrativa. |

## Swagger UI / API

Las capturas `SW-02` a `SW-25` muestran solicitudes ejecutadas desde Swagger UI y conservan la ruta, los datos enviados, el código HTTP y el cuerpo de respuesta. Cubren respuestas 200, 201, 400, 401, 403, 404, 409 y 503, además del reintento seguro del retiro.

## Reproducción

Desde la raíz del repositorio:

```bash
pnpm --filter @zav/api test:e2e
pnpm --filter @zav/web test:e2e
```

Las credenciales de prueba se proporcionan al proceso automatizado como variables del entorno de ejecución y no se almacenan en este archivo.

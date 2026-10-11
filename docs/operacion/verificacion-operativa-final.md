# Verificación operativa y límites de los resultados

Documento técnico de respaldo para la monografía. Esta bitácora describe comprobaciones efectuadas y separa sus resultados de las verificaciones que no se han ejecutado. Se incluyen únicamente métricas agregadas, sin registros personales ni credenciales.

## 1. Estado del despliegue

- Rama de aplicación integrada: `main`, referencia inicial de cierre técnico `120a067687e701ad5194b8acdcc3050cf853730e`.
- Frontend administrativo: Vercel, producción, `READY`, desde la rama `main`.
- API: servicio Render `zav-api-2026`, estado `live` para la misma referencia. Su inicialización se corroboró en los registros de NestJS.
- PostgreSQL: proyecto Neon `zav-sistema`, rama de referencia `production`, base `neondb`. No divulgar la dirección ni las claves de conexión.
- Ruta de salud: `GET https://zav-api-2026.onrender.com/api/v1/salud` realiza `SELECT 1`; su error se maneja como HTTP 503.
- QA sobre la integración: backend y Playwright satisfactorios; también verificaciones públicas y medición de respuesta (referencias completas en GitHub Actions).

## 2. Rendimiento de una ruta pública

**Método:** 20 solicitudes HTTP GET secuenciales a la ruta de salud, con una fase previa de reactivación; una sola solicitud en vuelo; ejecución desde GitHub Actions.

**Resultado observado:** 20/20 respuestas HTTP 200, mínimo 0,086 s; mediana 0,103 s; promedio 0,108 s; p95 0,129 s; máximo 0,163 s. Los tiempos fueron obtenidos antes de la última publicación de la ruta de salud que consulta PostgreSQL. Una ejecución anterior falló por tiempo de espera de 60 segundos y se conserva.

**Referencia de la ejecución y sus 20 muestras:** https://github.com/RubenMealla/zav-sistema/actions/runs/38098191932

No extrapolar a carga concurrente ni a registro de pedidos. La reactivación del alojamiento gratuito puede producir latencias significativamente mayores.

## 3. Ejecución de una consulta real de negocio

**Método:** `EXPLAIN (ANALYZE, FORMAT JSON)` en Neon sobre una consulta SELECT de `pedido` con uniones a `cliente` y `usuario`, ordenada por creación, con límite de 50 filas. La tabla contenía 24 pedidos; no se añadieron pedidos sintéticos a producción.

```sql
SELECT p.id, p.estado, p.creado_en, c.id AS cliente_id, u.id AS vendedor_id
FROM public.pedido AS p
JOIN public.cliente AS c ON c.id = p.cliente_id
JOIN public.usuario AS u ON u.id = p.vendedor_id
ORDER BY p.creado_en DESC
LIMIT 50;
```

| Ejecución | Filas obtenidas | Tiempo de ejecución PostgreSQL |
|---:|---:|---:|
| 1 | 24 | 0,173 ms |
| 2 | 24 | 0,152 ms |
| 3 | 24 | 0,119 ms |
| 4 | 24 | 0,116 ms |
| 5 | 24 | 0,118 ms |

La medición anterior es **tiempo de ejecución dentro del motor PostgreSQL**. No incluye serialización JSON, autenticación JWT, comunicación entre servicios, red ni representación visual. No se realizó una prueba HTTP de la consulta protegida ni un escenario con 100 pedidos; no afirmar el cumplimiento de objetivos temporales de esas operaciones sin medirlos.

## 4. Recuperación mediante ramificación aislada

**Fuente:** rama Neon `production` (identificador `br-dry-hat-b6mxo2xi`).

**Copia aislada:** `qa-recuperacion-aislada-monografia-20261010` (identificador `br-shiny-feather-b63ylij1`). Copia independiente sin modificar las tablas de la fuente.

| Tabla | Rama de producción | Copia aislada |
|---|---:|---:|
| usuario | 6 | 6 |
| cliente | 9 | 9 |
| producto | 15 | 15 |
| lote | 15 | 15 |
| movimiento | 60 | 60 |
| pedido | 24 | 24 |
| detalle_pedido | 24 | 24 |
| typeorm_migraciones | 7 | 7 |

La comparación de esquemas entre las dos ramas no devolvió diferencias.

**Precisión:** esta operación demuestra la creación y consulta de una rama con estado de datos recuperado en forma aislada; no es la restauración desde un archivo `pg_dump` ni constituye una política de copias externas verificadas. El intento de instantánea sobre `production` no fue admitido por Neon porque esa rama no es la raíz. La prueba de restauración desde respaldo externo no se ha realizado.

## 5. Disponibilidad y seguimiento

El workflow `.github/workflows/verificacion-publica-e4.yml` configura ejecución horaria aproximada, consulta API y web, contempla tres intentos y deja trazabilidad en GitHub. Hay comprobación satisfactoria tras la integración:

https://github.com/RubenMealla/zav-sistema/actions/runs/38098308673

La ejecución inicial observada fue originada por una publicación en GitHub, no una comprobación programada. No se deduce un porcentaje de disponibilidad de una única ejecución. Las incidencias históricas no se eliminan para preservar el diagnóstico.

## 6. Verificaciones restringidas

- **Cuenta por rol en producción:** no se efectuó en esta sesión una prueba completa en interfaz pública con credenciales verificadas de demostración. Las pruebas de 401/403 en entornos aislados y el QA web aprobado constan en sus informes respectivos.
- **Distribución Android:** GitHub Actions conserva un APK de versión 1.0.0, compilación 10000, en el registro https://github.com/RubenMealla/zav-sistema/actions/runs/38027357295. Su archivo de descarga expira, por lo que no se afirma que sea una distribución permanente.
- **Respaldo tradicional restaurado:** no ejecutado; documentar antes de utilizar como argumento de recuperación completa ante el tribunal.

## 7. Seguridad y límites

No insertar secretos, claves API, contraseñas de demostración, identificadores de clientes ni cadenas completas de conexión. Estas verificaciones se efectuaron con operaciones de solo lectura; las pruebas de desarrollo emplean entornos aislados. La rama de recuperación se conserva como evidencia y debe revisarse conforme a las políticas de retención y costes del proveedor.

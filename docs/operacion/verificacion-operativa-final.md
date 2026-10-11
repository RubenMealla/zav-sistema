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

## 8. Ensayo reproducible de la consulta HTTP de pedidos y restauración

Se creó un ensayo de integración separado de la base empresarial mediante el proceso de GitHub Actions `.github/workflows/qa-recuperacion-rendimiento.yml`. La preparación exige `NODE_ENV=test` y una conexión local a la base `zav_test`, lo que impide ejecutar el procedimiento sobre Neon.

La prueba construyó un entorno PostgreSQL 18 aislado con sus siete migraciones, cuentas sintéticas y cien pedidos ficticios con cien detalles. Sobre el backend NestJS, y después de iniciar una sesión sintética de Administrador, se enviaron **25 solicitudes HTTP GET** a `/api/v1/admin/pedidos?limit=100&page=1`. Todas devolvieron HTTP 200, 100 filas y un total de 100 pedidos.

| Indicador | Resultado |
|---|---:|
| Solicitudes satisfactorias | 25 de 25 |
| Mediana | 3,860 ms |
| Percentil 95 | 10,521 ms |
| Promedio | 5,573 ms |
| Máximo | 15,554 ms |
| Concurrencia | 1 solicitud a la vez |

Son tiempos observados desde el ejecutor CI contra la API y PostgreSQL locales, **no tiempos del sistema publicado en Render o Vercel**. No se atribuye una meta de dos segundos al RNF-01 porque su redacción no la establece. La prueba ilustra que la consulta paginada admite cien registros en el entorno utilizado.

El mismo ensayo generó una copia `pg_dump -Fc` de la base ficticia y la restauró en otra base independiente mediante `pg_restore`; la comprobación posterior devolvió **100 pedidos, 100 detalles y siete migraciones** en ambas bases. Esto verifica un procedimiento de respaldo y restauración con datos de ensayo, pero **no una restauración desde un respaldo de la base productiva de Neon**, que debe prepararse con controles de acceso y una política de conservación específica.

Ejecución y evidencias JSON reproducibles: https://github.com/RubenMealla/zav-sistema/actions/runs/38106873250.

## 9. Instalador Android con descarga persistente

El APK ya firmado y validado, correspondiente a ZAV Vendedor 1.0.0 (compilación Android 10000), se conservó **sin recompilarlo** en una publicación de GitHub y se verificó su suma SHA-256. La etiqueta de versión conserva como referencia el código utilizado para generar ese instalable.

- Publicación: https://github.com/RubenMealla/zav-sistema/releases/tag/zav-vendedor-v1.0.0
- APK: https://github.com/RubenMealla/zav-sistema/releases/download/zav-vendedor-v1.0.0/ZAV-Vendedor-1.0.0-build10000-release.apk
- Huella SHA-256: https://github.com/RubenMealla/zav-sistema/releases/download/zav-vendedor-v1.0.0/ZAV-Vendedor-1.0.0-build10000-release.apk.sha256

La publicación elimina la dependencia de la caducidad de los archivos temporales de las pruebas automatizadas. No equivale a una nueva prueba física de instalación ni a una nueva compilación del cliente móvil.

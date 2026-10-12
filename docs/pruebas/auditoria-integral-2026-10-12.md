# Auditoría técnica ZAV — 12 de octubre de 2026

Informe de ingeniería del PR [#71](https://github.com/RubenMealla/zav-sistema/pull/71), relacionado con las issues #67–#70. Complementa las evidencias académicas existentes; no sustituye ensayos físicos ni modifica sus resultados históricos.

## A. Estado inicial y alcance

- Rama: `mejora/calidad-arquitectura`; árbol limpio antes de editar. `fetch` y `pull --ff-only` confirmaron `e716516b5439d9a05785d1fdfa4019507cc57286` tanto local como remoto.
- `main` y `origin/main`: `522c81d78e1b7d33f01cf7b44b8c2e5f3945f770`. PR abierto, en borrador. Sus cuatro comprobaciones iniciales estaban aprobadas.
- Windows; Node.js 24.19.0; pnpm 12.4.2, coincidente con `packageManager`; PostgreSQL local 17.10. Next.js 16.3.5 → 16.3.8, React web 19.2.8, NestJS 12, TypeORM 1.1.1, Expo 57.0.24, React Native 0.86.3. Aplicaciones 1.0.0 y Android `versionCode=10000` conservados.
- Revisión de rutas y acciones web, sesión y roles, formularios/modal/SSR, módulos API, SQL y migraciones, inventario y distribución, cliente HTTP y pantallas móviles, diagnóstico, configuración Expo y seis workflows activos. Se consultaron README, guías técnicas y las cuatro issues.
- Las pruebas usan PostgreSQL **nuevo y aislado**, `127.0.0.1:55432/zav_test`, y credenciales sintéticas de QA. No se abrió una conexión a Neon, incluida `development-pc-20261011`; su latencia no queda evaluada. No se modificaron producción, Vercel, Render, dominios ni secretos.

## B. Hallazgos y evidencia

| Gravedad | Ubicación / operación | Causa y evidencia | Resolución |
|---|---|---|---|
| Crítica, por clasificación del proveedor | `pnpm-lock.yaml`, Next y shell-quote | Auditoría inicial: 2 avisos críticos, 5 altos, 6 moderados y 1 bajo. Son avisos de dependencias, no explotación demostrada en ZAV. | Next/eslint-config-next 16.3.8; shell-quote 1.11.0; source-map-js 1.2.2 y sharp 0.35.5. |
| Alta | `movimientos.service.ts`, `trasladar` | Condición/vigencia del lote leídas antes de esperar el bloqueo de producto; una liberación y reserva concurrentes podían invalidar esa lectura. E2E sincroniza ambas transacciones. | Leer y validar el lote después de adquirir los bloqueos; una consulta adicional protege la consistencia. |
| Alta | `pedidos.service.ts`, `editar` | Sumar la reserva anterior a una disponibilidad ya truncada a cero podía aprobar cantidades imposibles cuando expiraba stock. Regresión: físico 10, comprometido 15, pedido anterior 10; 14 debe rechazarse. | Calcular `max(0, físico - comprometido + cantidadAnterior)` antes de validar. |
| Alta | `app/api/geografia/autocompletar/route.ts`, `GET` | La mera presencia de cookie permitía llegar al proveedor externo, aun con token inventado. | Verificar sesión y rol ADMIN en API antes de cualquier proveedor; E2E sin cookie, cookie falsa y VENDEDOR. |
| Alta, rendimiento | `pedidos.service.ts`, `entregar` | Un SELECT seguido de un INSERT por cada lote retirado. Caso reproducible de diez lotes: 20 consultas totales. | Un `INSERT … SELECT … RETURNING` dentro de la misma transacción: 10 consultas totales. Rollback y repetición concurrente comprobados. |
| Media, funcional | `consultas-pedidos.ts`, `listarAdmin` | Fechas imposibles/ambiguas llegaban al cast SQL. Cuatro regresiones unitarias fallaron antes de corregir. | Validación ISO real previa a SQL; HTTP 400. |
| Media, funcional | `clientes.service.ts`, `editar` / `actualizarUbicacion` | UPDATE sin filas sobre cliente inactivo devolvía éxito aparente. | Comprobar filas afectadas y devolver 404; E2E conserva los datos. |
| Media, funcional y rendimiento | `mobile/src/lib/api.ts`, listados | Dos llamadas por estados activos y dos por clientes, con truncamiento a 100 por estado y total calculado sobre la muestra. | Estado `ACTIVOS` en una llamada paginada, total del servidor y carga siguiente en pantalla; directorio por páginas de 100 con `activo=todos`. Regresión con 101 clientes. |
| Media, disponibilidad | `mobile/src/lib/api.ts`, `solicitud` | Ausencia de límite temporal y JSON malformado sin error controlado. | AbortController: 60 s; retiros múltiples 120 s; configuración y salud 8 s. Error explícito; sin reintentos automáticos de escrituras. |
| Media, privacidad | `diagnostico-qa.ts`, `registrarSolicitudQa` | Solo se ocultaban UUID; otros identificadores y fragmentos podían persistir en memoria. | Lista permitida de segmentos, ocultación de parámetros/fragmentos y métodos controlados; capacidad 80, sin cuerpos, cabeceras, tokens ni persistencia. |
| Media | `metro.config.js`, configuración y consola QA | El control de interfaz no garantizaba la exclusión de los módulos diagnósticos del bundle release. | Resolver Metro sustituye configuración dinámica y diagnóstico; mapas de fuentes verifican que los cuatro módulos exclusivos no están en release. |
| Media, funcional | `consola-qa.tsx`, hora | Extraer caracteres de un ISO conservaba UTC. `2026-10-13T02:05:09Z` aparecía 02:05:09. | `Intl.DateTimeFormat`, `America/La_Paz`, `h23`: 22:05:09, con etiqueta Bolivia. ISO interno intacto. |
| Media, navegación | `landing-publica.tsx`, observador de secciones | Márgenes verticales porcentuales de IntersectionObserver se calculan sobre el ancho; a 1440×1000 dejaban vacía la franja observada. Playwright fallaba al activar Productos. | Márgenes en píxeles derivados del alto, actualización al redimensionar y estado de todas las secciones visibles. Regresión en dos alturas. |
| Media, mantenimiento | `pedidos.service.ts` | 860 líneas mezclaban consultas y operaciones transaccionales. | Consultas agrupadas en `consultas-pedidos.ts`; servicio de comandos queda en 551 líneas, sin cambiar contratos. |
| Baja | `panel/page.tsx`, alcance del resumen | El texto decía máximo 30 aunque la petición traía 50 lotes. | Mostrar el límite devuelto por la API. Se conserva la indicación de que las existencias pertenecen a los lotes consultados. |

La semántica de márgenes está descrita en la [especificación de Intersection Observer](https://w3c.github.io/IntersectionObserver/#dom-intersectionobserver-rootmargin). Los avisos de Next incluyen [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) y [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4).

## C. Comportamiento conservado

Se mantienen JWT, Argon2, roles, validaciones, restricciones SQL, bloqueos transaccionales, auditoría e idempotencia. La entrega conserva registro de coordenadas, precisión y distancia. No se cambió su política geográfica, el calendario de pedidos ni otras horas de negocio. No hay caché nueva de stock/estados, migraciones, funcionalidades de venta, cambios de identidad visual o de versión.

Se revisaron las recomendaciones de React: efectos con limpieza, importaciones por variante, estado paginado y límites de cliente/servidor. Las operaciones de inventario no se paralelizaron indiscriminadamente. La planificación ya consulta pedidos en conjunto; no se añadió un índice sin una medición que lo justifique.

## D. Rendimiento reproducible

NestJS real por HTTP y PostgreSQL 17.10 local: 25 muestras secuenciales, un calentamiento excluido, diez lotes por pedido. Misma semilla, reinicio aislado entre ejecuciones. [Datos originales y muestras](evidencias/auditoria-20261012/rendimiento.json).

| Operación | SQL antes → después | Mediana antes → después (ms) | P95 antes → después (ms) |
|---|---:|---:|---:|
| Planificar dos pedidos | 2 → 2 | 10,940 → 11,239 | 22,192 → 22,962 |
| Retirar diez lotes | 24 → 24 | 36,664 → 36,413 | 45,945 → 58,912 |
| Confirmar entrega | 20 → 10 | 22,765 → 19,262 | 34,080 → 29,273 |

La reducción demostrada es de diez consultas en entrega. No se afirma mejora temporal de planificación ni retiro: el P95 de retiro subió en esta muestra. Los tiempos locales no representan Neon, red Wi-Fi, GPS o teléfonos físicos.

En móvil, pedidos activos pasan de dos solicitudes a una por página. Un directorio de hasta 100 clientes pasa de dos solicitudes a una. Para más clientes se hacen las páginas necesarias, evitando omisiones. No se atribuye un porcentaje de rapidez de pantalla sin medición física.

Reproducir desde la raíz, configurando previamente las variables sintéticas documentadas por los workflows:

```powershell
$env:NODE_ENV='test'
$env:DATABASE_URL='postgresql://postgres@127.0.0.1:55432/zav_test'
node -e "import('./apps/api/test/global-setup-e2e.mjs').then(m => m.default())"
pnpm --filter @zav/api build
node apps/api/scripts/qa-medir-distribucion.mjs resultado.json
```

El setup destruye únicamente el esquema del destino de pruebas; ambos scripts rechazan destinos ajenos a PostgreSQL local `zav_test`. No usar una conexión Neon con estos comandos.

## E. Verificación

| Comando / control | Resultado local |
|---|---|
| `pnpm install --frozen-lockfile` | Aprobado con política de cadena de suministro original. |
| `pnpm --filter @zav/api lint` | Aprobado, sin advertencias finales. |
| `pnpm --filter @zav/api build` | Aprobado; incluye TypeScript. |
| `pnpm --filter @zav/api test` | 8 archivos, 26 pruebas aprobadas (22 iniciales). |
| `pnpm --filter @zav/api test:e2e` | 4 archivos, 33 pruebas aprobadas (27 iniciales). |
| `pnpm --filter @zav/web lint` | Aprobado; advertencia preexistente por `<img>` del catálogo original. |
| `pnpm --filter @zav/web build` | Aprobado con Next 16.3.8; incluye TypeScript. |
| `pnpm --filter @zav/web exec playwright test --timeout=120000` | 34 aprobadas, sin reintentos, en 5,1 min; conserva las assertions. Timeout ampliado solo en esta ejecución local. CI mantiene su configuración original. |
| `pnpm --filter @zav/mobile lint` y `exec tsc --noEmit` | Aprobados. |
| `pnpm --filter @zav/mobile test` | 11 regresiones: hora, privacidad, red, paginación y separación. |
| Exportaciones Android QA/release y `scripts/verificar-bundle.mjs` | Inspección del grafo real de Metro y textos de interfaz. |
| `expo config --type introspect --json` en ambos canales | Identidades y permiso HTTP por variante; sin aplicar prebuild al proyecto. |
| `pnpm audit --prod` | 14 → 4 avisos: 0 críticos, 2 altos y 2 moderados finales. Sale con código 1; no es una auditoría verde. Véase pendientes. |
| `expo install --check` | Detecta ocho parches recomendados, pendientes por política de antigüedad. |
| `pnpm peers check` | Dos incompatibilidades preexistentes, detalladas en pendientes. |

Se investigaron y corrigieron los fallos intermedios: cast SQL de entrega (`42P08`), forma del resultado UPDATE de TypeORM, parámetro opcional introducido durante la extracción y tipo de paginación web incompleto. Las assertions se conservaron. La primera ejecución completa de Playwright tuvo 32 aprobadas, una prueba que pasó al reintentar tras `ENOSPC` y el fallo reproducible de navegación; no se contabiliza como aprobada. La segunda tuvo 29 aprobadas, un timeout en el escenario largo de Swagger y cuatro omitidas por su grupo serial. La repetición final se hizo sin exportaciones Metro simultáneas en la máquina de 4 GB de RAM, con 120 s por escenario, y aprobó las 34. Las terminaciones de los servidores al finalizar Playwright imprimen `ELIFECYCLE`; el proceso de pruebas final devuelve código 0.

La instalación transitoria de parches Expo se interrumpió por espacio y luego se descartó al comprobar que requería excepciones a `minimumReleaseAge`. Se restauraron exclusivamente esos cambios propios, conservando los parches de seguridad anteriores. No se incluyeron excepciones ni se desactivaron controles.

Los resultados de Actions del SHA publicado se registran en la conversación del PR #71. Los workflows 01–04 conservan sus artefactos, agregando regresiones móviles, verificación de bundles y hora sobre APK QA. No se borran workflows históricos ni ejecuciones. El workflow especial 06 no se disparó contra infraestructura ni restauró bases compartidas.

## F. Android

| Aspecto | Producción | QA |
|---|---|---|
| Nombre | ZAV Vendedor | ZAV Vendedor QA |
| Paquete | `bo.zav.gestion.vendedor` | `bo.zav.gestion.vendedor.qa` |
| API | Fija de compilación; sin lectura de dirección QA persistida | Dirección privada de PC configurable y persistida en SecureStore |
| Diagnóstico | Sustitución sin consola ni registro QA | Consola en memoria, máximo 80 registros |
| HTTP sin TLS | No habilitado por el plugin QA | Habilitado para pruebas locales |
| Versiones/firma | Sin cambios | Sin cambios |

La protección QA rechaza también la URL productiva con variaciones de mayúsculas y punto final. No constituye una barrera contra alias DNS externos administrados por terceros; para pruebas debe usarse la API local o el entorno de desarrollo autorizado.

La hora se prueba con ISO UTC, medianoche, cambio de día/año y cuatro zonas de proceso. El nuevo job Android instala el APK QA, consulta un servidor sintético de salud y verifica visualmente `HH:mm:ss Bolivia (UTC-04:00)` con el emulador en UTC y Tokio; captura XML, imagen y JSON. Su resultado efectivo debe leerse en Actions, no inferirse de la prueba Node.

No había dispositivo ADB ni AVD local. La descarga de imagen Android falló por espacio. Por ello no se generó APK local ni se ensayó un teléfono físico. La compilación nativa QA se delega al workflow existente; release se verifica mediante configuración/bundle y no se publica ni instala en producción. GPS real, permisos del fabricante, teclado y convivencia de ambas aplicaciones requieren validación física.

## G. GitHub e historial

Entrega únicamente en `origin/mejora/calidad-arquitectura`, mediante commit convencional y autor Git existente. El detalle de archivos está en el diff del PR y el SHA final en su comentario de cierre de auditoría. No hay merge, rebase, force push, eliminación de ramas, nuevas releases ni cambios de protección de `main`. `.env`, secretos, bases locales, APK y logs temporales quedan fuera del commit.

## H. Pendientes y límites

1. Dependencias transitivas: `node-forge` y `braces` tienen avisos altos sin versión corregida indicada; `uuid@7` y `decode-uri-component@0.2` tienen avisos moderados cuya actualización cambia compatibilidad. Forge/braces/uuid aparecen en herramientas de Expo/compilación; decode-uri-component llega por Expo Router/query-string. No se forzaron overrides incompatibles. Revisar avisos y versiones del proveedor antes del cierre de seguridad.
2. Expo recomienda ocho parches; la actualización coordinada introduce paquetes todavía dentro del periodo de protección de pnpm. Repetir `expo install --check` y evaluar actualización tras cumplir la antigüedad, seguida de ambas compilaciones. No cambiar la versión comercial por ello.
3. Peers previos: CLI React Native 0.86.3 frente a metro-config 0.87.1 auto resuelto, y tipos React DOM 19.3 frente a tipos React móvil 19.2. No impiden las verificaciones actuales, pero merecen actualización coordinada del SDK.
4. Login sin limitación de intentos a nivel de aplicación: endurecimiento pendiente con política explícita de proxies, almacenamiento y usuarios compartiendo IP; no introducir bloqueos improvisados antes del cierre.
5. Pantallas móviles grandes (`vendedor-screen.tsx`, `mapas.tsx`) y panel web conservan responsabilidades amplias. Se recomienda extraer por flujo en una fase con pruebas de dispositivo, sin dividir por tamaño arbitrario. El historial móvil mantiene su límite existente por estado; el resumen web agrega la muestra inicial de lotes y ya informa ese alcance. No usar esta muestra como reporte global de existencias.
6. Falta medir red real hacia Neon development y sesiones con GPS. No extrapolar los milisegundos locales a teléfonos. La vigencia de lotes usa la fecha de PostgreSQL; no se alteró esa política para corregir exclusivamente la consola QA.
7. Permisos adicionales generados por Expo (almacenamiento/overlay, entre otros) se mantienen como antes; evaluar su minimización con pruebas nativas específicas.

## I. Recomendación técnica

Mantener el PR abierto hasta aprobar Actions en el SHA final y completar el ensayo físico QA (entrada de IP, pérdida de conexión, reorganizar reparto, retiro individual/múltiple, entrega/GPS y separación de variantes). Revisar los avisos transitivos pendientes y aceptar o resolver su exposición con evidencia. No recomendar una integración incondicional mientras estas comprobaciones estén pendientes. Los cambios transaccionales y de rendimiento ya tienen regresiones locales; la aceptación final debe incluir Android real. No se realizó el merge.

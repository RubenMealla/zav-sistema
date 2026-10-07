# Sistema ZAV

Sistema web y móvil para la gestión de productos terminados, pedidos y distribución de Fiambres y Embutidos ZAV. Trabajo Final del Diplomado en Desarrollo Web y Aplicaciones Móviles de la Universidad Autónoma Juan Misael Saracho (UAJMS), Tarija, Bolivia, gestión 2026.

## Alcance y roles

La solución se organiza como un monorepo con una API REST central y dos clientes diferenciados por rol:

- **Administrador — aplicación web:** autenticación, productos, lotes, condición comercial, inventario administrativo, auditoría de pedidos y configuración de Venta y Despacho.
- **Vendedor — aplicación móvil:** clientes, pedidos, retiro, organización de reparto y entrega con ubicación GPS puntual.
- **Acceso público:** únicamente las funciones que se habiliten expresamente sin autenticación. El catálogo/noticias/promociones no forman parte de los Must de E3.

No se incluyen materias primas, recetas, proveedores, compras, costos de producción, facturación fiscal, seguimiento GPS continuo ni optimización automática de rutas.

## Arquitectura

```text
Next.js / React (Administrador)
             |
             | HTTPS / JSON
             v
      NestJS REST API
             |
             | PostgreSQL
             v
      Neon development

React Native / Expo (Vendedor)
             |
             +---- HTTPS / JSON ----> misma API
```

La API concentra autenticación, autorización y reglas de negocio. Los permisos no dependen de ocultar botones en los clientes.

La aplicación móvil utiliza MapLibre React Native con OpenFreeMap y `expo-location`. La búsqueda y geocodificación de direcciones se realizan a través del backend, que integra Geoapify cuando la clave está configurada. La aplicación web estable incluye el mapa administrativo de Distribución para configurar el punto de salida de Venta y Despacho.

## Modelo de inventario

El modelo principal de E3 se limita a ocho entidades de negocio:

`Usuario, Cliente, Producto, Lote, Ubicacion, Movimiento, Pedido, DetallePedido`.

**Movimiento es la fuente de verdad del inventario físico.** El saldo actual se obtiene mediante la vista SQL `saldo_inventario`, calculada desde los movimientos de entrada y salida por lote y ubicación. No existe un endpoint para sobrescribir saldos.

`lote_condicion_historial` se conserva como estructura técnica de auditoría de cambios de condición. No constituye una entidad principal de negocio.

## Tecnologías

| Capa | Tecnologías principales |
|---|---|
| Web | Next.js 16.3.5, React 19.2.8, TypeScript |
| Móvil | React Native 0.86.3, Expo SDK 57, Expo Router, TypeScript |
| Mapas móvil | MapLibre React Native, OpenFreeMap, expo-location |
| API | NestJS 12, Node.js 24, TypeScript, TypeORM |
| Datos | PostgreSQL 18, Neon |
| Web pública | Vercel |
| API pública | Render |
| QA | Vitest, Supertest, Playwright, GitHub Actions |
| Gestión | GitHub Issues/PR/Actions y Trello Kanban |

Las versiones efectivas de dependencias se encuentran en los archivos `package.json` y `pnpm-lock.yaml`.

## Entornos y URLs de revisión

- Web estable: https://zav-sistema.vercel.app
- API estable: https://zav-api-2026.onrender.com
- Salud: https://zav-api-2026.onrender.com/api/v1/salud
- Repositorio: https://github.com/RubenMealla/zav-sistema
- Base de datos utilizada durante E3: rama Neon `development`
- Rama Neon `production`: reservada para el cierre productivo posterior

**Vercel Production** sigue la rama Git `main`.  
**Render `zav-api-2026`** sigue la rama Git `main`.  
El servicio `zav-api-e3-dev` se conserva temporalmente como entorno histórico/de desarrollo y no se considera la API canónica.

La ruta de salud responde:

```json
{"estado":"ok"}
```

## Ejecución local

Desde la raíz:

```bash
pnpm install
```

Web:

```bash
pnpm --filter @zav/web dev
```

API:

```bash
pnpm --filter @zav/api start:dev
```

Móvil:

```bash
pnpm --filter @zav/mobile start
```

## Variables de entorno

La API documenta su configuración en `apps/api/.env.example`. Los valores reales permanecen fuera de Git.

Variables principales:

```dotenv
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...
CORS_ORIGINS=http://localhost:3000,https://zav-sistema.vercel.app
JWT_SECRET=
GEOAPIFY_API_KEY=
```

Nunca se versionan archivos `.env`, cadenas de conexión reales, tokens, contraseñas válidas ni claves de servicio.

## Seguridad

- Contraseñas almacenadas con Argon2id.
- JWT de acceso con expiración.
- Autorización por rol comprobada en NestJS.
- Una ruta protegida sin token responde 401.
- Un usuario autenticado con rol incorrecto responde 403.
- Validación de entrada en servidor y validación de usabilidad en los clientes.
- CORS restringido a los orígenes web configurados.
- Los errores internos no exponen trazas, contraseñas ni secretos.
- La baja de Producto es lógica y preserva trazabilidad histórica.
- Los smoke tests públicos no almacenan credenciales válidas en el repositorio.

## API E3

El contrato completo y versionado se encuentra en `docs/api/openapi-e3.yaml`. Resumen de rutas principales:

| Método | Ruta | Rol |
|---|---|---|
| GET | `/api/v1/salud` | Público |
| POST | `/api/v1/auth/login` | Público |
| GET | `/api/v1/auth/me` | Autenticado |
| GET | `/api/v1/productos` | Administrador / Vendedor |
| POST/PATCH | `/api/v1/productos...` | Administrador |
| GET/POST | `/api/v1/lotes` | Administrador |
| POST | `/api/v1/lotes/:id/liberar` | Administrador |
| POST | `/api/v1/lotes/:id/bloquear` | Administrador |
| POST | `/api/v1/movimientos/traslado` | Administrador |
| GET/POST/PATCH | `/api/v1/clientes...` | Vendedor |
| GET/POST/PATCH | `/api/v1/pedidos...` | Vendedor |
| POST | `/api/v1/pedidos/:id/retiro` | Vendedor |
| POST | `/api/v1/pedidos/retiros` | Vendedor |
| POST | `/api/v1/pedidos/:id/entrega` | Vendedor |
| POST | `/api/v1/pedidos/:id/cancelacion` | Vendedor |
| POST | `/api/v1/pedidos/planificacion` | Vendedor |
| GET | `/api/v1/pedidos/disponibilidad` | Vendedor |
| GET | `/api/v1/admin/pedidos` | Administrador |
| GET | `/api/v1/geografia/*` | Vendedor |
| GET | `/api/v1/ubicaciones/venta-despacho` | Autenticado |
| PATCH | `/api/v1/ubicaciones/:id/georreferencia` | Administrador |

Los comandos críticos utilizan `operacionClave` para idempotencia. Repetir la misma operación con los mismos datos no duplica movimientos; reutilizar la misma clave para una operación diferente se rechaza.

## Pruebas

API:

```bash
pnpm --filter @zav/api lint
pnpm --filter @zav/api build
pnpm --filter @zav/api test
pnpm --filter @zav/api test:e2e
```

Web:

```bash
pnpm --filter @zav/web lint
pnpm --filter @zav/web build
pnpm --filter @zav/web test:e2e
```

Móvil:

```bash
pnpm --filter @zav/mobile lint
pnpm --filter @zav/mobile exec tsc --noEmit
```

GitHub Actions ejecuta QA con PostgreSQL aislado. Los reportes, logs y capturas se conservan como evidencia. Los errores y ejecuciones fallidas reales también se conservan; una ejecución satisfactoria posterior no borra el historial de incidencias.

La documentación de QA de E3 incluye:

- `docs/pruebas/matriz-qa-e3.md`;
- `docs/pruebas/registro-defectos-e3.md`;
- evidencias Playwright de 400, 401, 403, 404, 409 y 503;
- evidencia web de validación doble: la API devuelve 400 aun cuando se evita deliberadamente la validación HTML del navegador, y la interfaz muestra el error;
- cobertura E2E del 500 y rollback transaccional;
- validación física de ZAV Vendedor 1.0.0;
- build APK firmado y versionado.

## Kanban y trazabilidad

El proyecto utiliza Kanban en Trello con estas columnas:

`Pendiente → Por realizar → En desarrollo (máx. 1) → En verificación → Terminado`.

La trazabilidad de una tarea técnica sigue, cuando corresponde:

`Trello → GitHub Issue → rama → commits → Pull Request → GitHub Actions → reporte/captura → requisito del documento`.

El límite WIP de la columna **En desarrollo es 1**, coherente con un desarrollo individual.

Tablero: https://trello.com/b/Tn5elZCY/zav-2026-desarrollo-del-sistema-kanban

## Estado de E3

**Integrado y estable en `main`:**

- autenticación JWT y autorización por roles en servidor;
- productos, lotes, condición comercial, movimientos y traslados;
- Movimiento como fuente de verdad y vista `saldo_inventario`;
- Cliente y georreferenciación dentro de Tarija;
- Pedido y DetallePedido;
- disponibilidad con compromisos de pedidos registrados;
- Retiro FEFO hacia `EN_DISTRIBUCION`;
- Entrega con GPS puntual;
- idempotencia de Retiro y Entrega;
- auditoría del Vendedor responsable;
- aplicación **ZAV Vendedor 1.0.0**, validada físicamente el 04/10/2026;
- APK release firmado y pipeline de QA.

**QA/documentación:** Issue #54 y la rama `pruebas/evidencias-qa-reales` reúnen las capturas verificables de Swagger UI y de la interfaz web utilizadas en el documento. La ejecución web de referencia es Playwright #761, asociada al commit `c41c7fd1183abbee361798881d6ec1541b0a936a`, con resultado satisfactorio.

**Interfaz web estable:** `main` contiene la landing, login, panel administrativo, tablas, filtros, confirmaciones, mensajes visibles de error, CRUD de Producto y módulo Distribución.

**Capturas Android automatizadas:** Issue #43 queda separado de la aplicación estable. Los intentos fallidos del workflow se conservan como evidencia de QA y se retomarán después de ordenar la línea web.

No se considera una funcionalidad implementada únicamente porque aparezca diseñada o documentada.

## Política de ramas y evidencia

Para preservar la trazabilidad del Trabajo Final:

- no se eliminan ramas históricas;
- no se reescribe ni elimina el historial de commits;
- las ramas ya integradas se conservan como evidencia de evolución;
- las ramas de intentos de QA fallidos también se conservan;
- cada rama debe interpretarse por su estado documentado: activa, integrada, experimental o histórica;
- `main` representa la versión estable integrada;
- la clasificación detallada se mantiene en `docs/gestion/estado-repositorio-e3.md`.

## Autor

**Rubén Darío Mealla Lerma**  
Diplomado en Desarrollo Web y Aplicaciones Móviles  
Universidad Autónoma Juan Misael Saracho  
Tarija, Bolivia — 2026

# Sistema ZAV

Sistema web y móvil para la gestión de productos terminados, pedidos y distribución de Fiambres y Embutidos ZAV. Trabajo Final del Diplomado en Desarrollo Web y Aplicaciones Móviles de la Universidad Autónoma Juan Misael Saracho (UAJMS), Tarija, Bolivia, gestión 2026.

## Alcance y roles

La solución se organiza como un monorepo con una API REST central y dos clientes diferenciados por rol:

- **Administrador — aplicación web:** autenticación, productos, lotes, condición comercial e inventario administrativo.
- **Vendedor — aplicación móvil:** clientes, pedidos, retiro, distribución y entrega con ubicación GPS puntual.
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
          Neon

React Native / Expo (Vendedor)
             |
             +---- HTTPS / JSON ----> misma API
```

La API concentra autenticación, autorización y reglas de negocio. Los permisos no dependen de ocultar botones en los clientes.

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
| API | NestJS 12, Node.js 24, TypeScript, TypeORM |
| Datos | PostgreSQL 18, Neon |
| Web pública | Vercel |
| API pública | Render |
| QA | Vitest, Supertest, Playwright, GitHub Actions |
| Gestión | GitHub Issues/PR/Actions y Trello Kanban |

Las versiones efectivas de dependencias se encuentran en los archivos `package.json` y `pnpm-lock.yaml`.

## URLs de revisión

- Web: https://zav-sistema.vercel.app
- API: https://zav-api-2026.onrender.com
- Salud de la API: https://zav-api-2026.onrender.com/api/v1/salud
- Repositorio: https://github.com/RubenMealla/zav-sistema

La ruta de salud responde:

```json
{"estado":"ok"}
```

La URL de salud se considera evidencia de producción únicamente después de que la versión correspondiente haya sido integrada y desplegada.

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

La API documenta su configuración en `apps/api/.env.example`. Los valores reales deben permanecer fuera de Git.

Variables principales:

```dotenv
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...
CORS_ORIGINS=http://localhost:3000,https://zav-sistema.vercel.app
JWT_SECRET=
```

Nunca se versionan archivos `.env`, cadenas de conexión reales, tokens, contraseñas ni claves de servicio.

## Seguridad

- Contraseñas almacenadas con Argon2id.
- JWT de acceso con expiración.
- Autorización por rol comprobada en NestJS.
- Una ruta protegida sin token responde 401.
- Un usuario autenticado con rol incorrecto responde 403.
- Validación de entrada en servidor y validación de usabilidad en los clientes.
- CORS restringido a los orígenes web configurados.
- Los errores internos no deben exponer trazas, contraseñas ni secretos.
- La baja de Producto es lógica y preserva trazabilidad histórica.

## API base de inventario

| Método | Ruta | Rol |
|---|---|---|
| GET | `/api/v1/salud` | Público |
| POST | `/api/v1/auth/login` | Público |
| GET | `/api/v1/auth/me` | Autenticado |
| GET/POST | `/api/v1/productos` | Administrador |
| GET/PATCH | `/api/v1/productos/:id` | Administrador |
| PATCH | `/api/v1/productos/:id/baja` | Administrador |
| GET/POST | `/api/v1/lotes` | Administrador |
| POST | `/api/v1/movimientos/traslado` | Administrador |
| GET | `/api/v1/movimientos?loteId=...` | Administrador |
| POST | `/api/v1/lotes/:id/liberar` | Administrador |
| POST | `/api/v1/lotes/:id/bloquear` | Administrador |
| GET | `/api/v1/lotes/:id/condiciones` | Administrador |

Los comandos de inventario usan `operacionClave` para idempotencia. Repetir la misma operación con los mismos datos no duplica movimientos; reutilizar la misma clave para una operación diferente se rechaza.

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

GitHub Actions ejecuta QA con PostgreSQL aislado. Los reportes y artifacts de cada ejecución se conservan como evidencia. Durante el desarrollo se mantienen también los fallos reales detectados y sus correcciones; una ejecución final verde no significa que el desarrollo no haya tenido incidencias.

## Kanban y trazabilidad

El proyecto utiliza Kanban en Trello con estas columnas:

`Pendiente → Por realizar → En desarrollo (máx. 1) → En verificación → Terminado`.

La trazabilidad de una tarea técnica sigue, cuando corresponde:

`Trello → GitHub Issue → rama → commits → Pull Request → GitHub Actions → reporte/captura → requisito del documento`.

El límite WIP de la columna **En desarrollo es 1**, coherente con un desarrollo individual.

Tablero: https://trello.com/b/Tn5elZCY/zav-2026-desarrollo-del-sistema-kanban

## Estado de E3

**Implementado y bajo verificación en la rama de corrección T3/E3:**

- autenticación JWT y roles en servidor;
- CRUD de Producto, incluida edición y baja lógica;
- lotes e ingreso inicial idempotente;
- liberación/bloqueo auditado de lotes;
- traslados;
- saldo derivado de Movimiento;
- ruta pública de salud;
- formato uniforme de errores;
- pruebas de 401 y 403;
- QA backend y Playwright.

**Pendiente de implementar para completar todos los Must de E3:**

- Cliente;
- Pedido y DetallePedido;
- retiro de pedido;
- entrega con GPS puntual desde la aplicación móvil;
- evidencia final en producción de todos los Must.

No se considera una funcionalidad implementada únicamente porque aparezca diseñada o documentada.

## Autor

**Rubén Darío Mealla Lerma**  
Diplomado en Desarrollo Web y Aplicaciones Móviles  
Universidad Autónoma Juan Misael Saracho  
Tarija, Bolivia — 2026

# Guía de ubicación del código

Esta guía facilita cambios manuales durante el desarrollo y la presentación del sistema.

| Necesidad | Ruta |
|---|---|
| Menú y títulos del panel | `apps/web/app/panel/marco-panel.tsx` |
| Colores principales y variables visuales | `apps/web/app/globals.css` (bloque `:root`) |
| Diseño y tamaños del panel | `apps/web/app/estilos/panel.css` y `controles.css` |
| Diseño para pantallas pequeñas | `apps/web/app/estilos/responsive.css` |
| Pantalla de acceso | `apps/web/app/acceso/page.tsx` |
| Página pública | `apps/web/app/componentes/landing-publica.tsx` |
| Mensajes de error y éxito | `apps/web/app/panel/lib/mensajes-panel.ts` |
| Paginación del panel | `apps/web/app/panel/lib/paginacion-panel.ts` |
| Modales y notificaciones compartidos | `apps/web/app/componentes/interacciones.tsx` |
| URL de API en Next.js | `apps/web/app/lib/api-servidor.ts` |
| Endpoints y reglas del backend | `apps/api/src/**/` (archivos `*.controller.ts` y `*.service.ts`) |
| Login, JWT y roles | `apps/api/src/auth/` |
| Validaciones de inventario | `apps/api/src/inventario/validacion.ts` |
| Pedidos y distribución | `apps/api/src/pedidos/` |
| Consultas, disponibilidad y paginación de pedidos | `apps/api/src/pedidos/consultas-pedidos.ts` |
| Crear, editar, retirar y entregar pedidos con transacciones | `apps/api/src/pedidos/pedidos.service.ts` |
| Coordinación de la pantalla móvil | `apps/mobile/src/screens/vendedor-screen.tsx` |
| Listado, acciones y organización de pedidos | `apps/mobile/src/components/vendedor-pedidos.tsx` |
| Formularios de clientes y pedidos | `apps/mobile/src/components/vendedor-formularios.tsx` |
| Botones y controles compartidos | `apps/mobile/src/components/vendedor-ui.tsx` |
| Estilos de la pantalla móvil | `apps/mobile/src/screens/vendedor-estilos.ts` |
| Funciones geográficas y fechas móviles | `apps/mobile/src/lib/distribucion.ts` |
| Mapas, selectores e historial móvil | `apps/mobile/src/components/` |
| Conexión móvil a la API | `apps/mobile/src/lib/api.ts` |
| Configurar API en Android físico QA | `apps/mobile/src/lib/configuracion-api.ts` y `apps/mobile/src/screens/login-screen.tsx` |
| Permitir HTTP local exclusivamente en QA | `apps/mobile/plugins/with-qa-local-network.js` y `apps/mobile/app.config.js` |
| Workflows Android y QA | `.github/workflows/` |

## Comandos de revisión

Desde la raíz, con Node.js 24 y pnpm 12.4.2:

```powershell
pnpm --filter @zav/api lint
pnpm --filter @zav/api build
pnpm --filter @zav/api test
pnpm --filter @zav/api test:e2e
pnpm --filter @zav/web lint
pnpm --filter @zav/web build
pnpm --filter @zav/web test:e2e
pnpm --filter @zav/mobile lint
pnpm --filter @zav/mobile exec tsc --noEmit
pnpm --filter @zav/mobile test
```

Las pruebas E2E requieren un PostgreSQL exclusivo de QA. Los resultados se consideran verificados solamente después de comprobar la ejecución. Mantener las ramas y commits históricos, no publicar claves de `.env`, ni ejecutar pruebas destructivas sobre Neon Production.

## Diagnóstico exclusivamente en la APK QA

- `apps/mobile/src/components/consola-qa.tsx`: burbuja de diagnóstico, estado de API, últimas peticiones, filtro de errores.
- `apps/mobile/src/lib/diagnostico-qa.ts`: memoria temporal de hasta 80 solicitudes, sin cuerpos, cabeceras ni tokens.
- `apps/mobile/src/lib/api.ts`: registra método, ruta sin parámetros, estado HTTP y duración, solo al compilar QA.
- `apps/mobile/src/app/index.tsx`: presenta la consola únicamente si `EXPO_PUBLIC_BUILD_CHANNEL=qa`.
- `apps/mobile/app.config.js`: define paquete distinto y configuración HTTP local del APK QA; la compilación release no muestra la consola.
- `apps/mobile/src/lib/hora-qa.ts`: presenta `HH:mm:ss` con `America/La_Paz`; el registro conserva el ISO UTC.
- `apps/mobile/metro.config.js`: sustituye módulos QA por `qa-desactivado.ts` y `configuracion-api-release.ts` al generar release; su API queda fijada por la compilación.
- `apps/mobile/test/`: regresiones de hora, red, paginación, privacidad y separación de variantes.
- `apps/mobile/scripts/verificar-bundle.mjs`: verifica los módulos y textos presentes en el bundle Android de cada canal.
- `apps/mobile/scripts/qa-hora-android.py`: prueba el APK QA en emulador con zonas UTC y Tokio y una API sintética local.

## Mediciones aisladas

`apps/api/scripts/qa-medir-distribucion.mjs <salida.json>` requiere API compilada, `NODE_ENV=test`, `DATABASE_URL` local a `zav_test` y las cuentas sintéticas de E2E. Preparar primero con `test/global-setup-e2e.mjs`, que **recrea exclusivamente esa base de ensayo**. La medición arranca su API en un puerto libre, registra 25 muestras HTTP y cuenta SQL sin guardar consultas ni parámetros. No apunta a Neon. Consultar el informe de auditoría para interpretar los resultados.

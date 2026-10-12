# Guía de ubicación del código

Esta guía facilita cambios manuales durante el desarrollo y la presentación del sistema.

| Necesidad | Ruta |
|---|---|
| Menú y títulos del panel | `apps/web/app/panel/marco-panel.tsx` |
| Colores y tamaños del panel | `apps/web/app/estilos/panel.css` y `controles.css` |
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
| Coordinación de la pantalla móvil | `apps/mobile/src/screens/vendedor-screen.tsx` |
| Listado, acciones y organización de pedidos | `apps/mobile/src/components/vendedor-pedidos.tsx` |
| Formularios de clientes y pedidos | `apps/mobile/src/components/vendedor-formularios.tsx` |
| Botones y controles compartidos | `apps/mobile/src/components/vendedor-ui.tsx` |
| Estilos de la pantalla móvil | `apps/mobile/src/screens/vendedor-estilos.ts` |
| Funciones geográficas y fechas móviles | `apps/mobile/src/lib/distribucion.ts` |
| Mapas, selectores e historial móvil | `apps/mobile/src/components/` |
| Conexión móvil a la API | `apps/mobile/src/lib/api.ts` |
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
```

Las pruebas E2E requieren un PostgreSQL exclusivo de QA. Los resultados se consideran verificados solamente después de comprobar la ejecución. Mantener las ramas y commits históricos, no publicar claves de `.env`, ni ejecutar pruebas destructivas sobre Neon Production.

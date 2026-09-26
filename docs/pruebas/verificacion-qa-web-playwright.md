# Verificación de QA visual web con Playwright

Fecha de verificación: 26/09/2026  
Rama: `pruebas/automatizacion-web-playwright`

## Estado

**CONFIRMADO.** Configuré y ejecuté pruebas E2E de la interfaz web con Playwright 1.63.0, Chromium y GitHub Actions.

Las pruebas se ejecutaron contra una API NestJS local al runner y una base PostgreSQL 18 aislada denominada `zav_test`. No utilicé Neon `production` ni credenciales reales en esta automatización.

## Entorno automatizado

La ejecución de QA prepara los siguientes componentes:

- Node.js 24;
- pnpm 12.4.2;
- Playwright 1.63.0;
- Chromium instalado por Playwright;
- API NestJS compilada y ejecutada en el runner;
- aplicación Next.js compilada y ejecutada en el runner;
- PostgreSQL 18 temporal con la migración inicial del proyecto;
- cuenta administrativa sintética `admin.qa`;
- cuenta Vendedor sintética `vendedor.qa`.

La base de pruebas se recrea antes de la ejecución y la preparación rechaza conexiones que no apunten a PostgreSQL local y a `zav_test`.

## Ejecución final

Workflow: `QA web Playwright`  
Ejecución final verificada: #3  
Commit: `e3529a95893f7a9987e774a44fe49d0e6da40b2f`  
Resultado: **success**  
Pruebas: **2 aprobadas de 2**  
Duración reportada por Playwright: **7.7 s**  
Artifact: `qa-web-playwright-3`

Ejecución:

https://github.com/RubenMealla/zav-sistema/actions/runs/36278940354

## Casos comprobados

### PW-WEB-001 · Protección del panel sin sesión

Abrí directamente `/panel` sin una sesión administrativa.

Comprobé que:

- la aplicación redirige a `/acceso?error=sesion`;
- la pantalla informa que la sesión no existe o dejó de ser válida;
- el panel interno no queda accesible sin autenticación.

Resultado: **APROBADO**.

### PW-WEB-002 · Flujo administrativo de inventario

Ejecuté el flujo completo con la cuenta administrativa sintética.

Comprobé que:

1. la pantalla de acceso carga correctamente;
2. el inicio de sesión administrativo conduce al panel;
3. el panel identifica al usuario como Administrador;
4. se registra el producto sintético `QA-WEB-001`;
5. el producto queda visible en la tabla;
6. se registra el lote sintético `QA-WEB-LOTE-001`;
7. el lote queda en condición `RETENIDO`;
8. la existencia inicial queda registrada en `PRODUCCION_ALMACENAMIENTO` con cantidad 12;
9. al recargar la página, el producto, lote y existencia continúan visibles.

Resultado: **APROBADO**.

## Evidencias visuales generadas

El artifact final contiene seis capturas PNG generadas durante la ejecución real:

1. `01-panel-protegido-sin-sesion.png`;
2. `02-acceso-administrativo.png`;
3. `03-panel-inventario.png`;
4. `04-producto-registrado.png`;
5. `05-lote-registrado.png`;
6. `06-persistencia-despues-recarga.png`.

También contiene:

- reporte HTML de Playwright;
- un trace del caso de protección del panel;
- un trace del flujo administrativo completo.

Comprobé en el artifact que la captura `05-lote-registrado.png` muestra el producto `QA-WEB-001`, el lote `QA-WEB-LOTE-001`, la condición `RETENIDO` y la existencia `PRODUCCION_ALMACENAMIENTO: 12`.

## Iteraciones detectadas por CI

Las primeras ejecuciones no se registran como aprobadas:

- ejecución #1: el build detectó un error de tipado en el selector de una opción de Playwright;
- ejecución #2: Playwright detectó que el selector genérico `role=alert` coincidía con dos elementos de Next.js.

Corregí ambos problemas y repetí la ejecución. La ejecución #3 fue la primera que completó build, arranque de API, arranque web, las dos pruebas y carga del artifact sin fallos.

Esto permite conservar un historial real de corrección y no presentar resultados simulados.

## Manejo de credenciales y datos

Los usuarios, contraseñas, producto y lote utilizados por GitHub Actions son datos sintéticos exclusivos de `zav_test`.

Las capturas no muestran contraseñas. No utilicé la cuenta administrativa real, la cuenta `vendedor.pruebas`, Neon `production` ni secretos de Render o Vercel.

## Alcance actual

Esta verificación demuestra el flujo web administrativo disponible en la iteración actual: acceso, consulta y alta inicial de productos y lotes.

No demuestra todavía:

- interfaz web para el rol Vendedor;
- pedidos;
- distribución;
- GPS;
- aplicación móvil;
- pruebas multidispositivo o entre Chromium, Firefox y WebKit.

Esos casos deberán comprobarse cuando sus funcionalidades correspondientes estén implementadas.

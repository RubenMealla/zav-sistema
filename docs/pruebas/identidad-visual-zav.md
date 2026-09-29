# QA de identidad visual ZAV — Issue #25

Fecha: 28/09/2026, America/La_Paz. Repositorio: `RubenMealla/zav-sistema`. Rama: `desarrollo/identidad-visual-zav`. Trabajo exclusivamente local, sin push, PR ni reescritura de historial.

## Entorno real

- Windows, Node.js 24.20.0, pnpm 12.4.2; Next.js 16.3.5, React 19.2.8 y Playwright 1.63.0 del repositorio.
- Chromium 153.0.8010.12 instalado con `pnpm --filter @zav/web exec playwright install chromium`.
- API existente compilada con `pnpm --filter @zav/api build` (código 0), sin cambios en sus fuentes.
- PostgreSQL 18.6 portátil obtenido de los [binarios de EDB](https://www.enterprisedb.com/download-postgresql-binaries), en un directorio temporal; sin instalar un servicio de Windows.
- Clúster temporal propio, limitado a `127.0.0.1:55432`, base `zav_test`. Preparación mediante el fixture existente `apps/api/test/global-setup-e2e.mjs`, que exige entorno `test`, host local y nombre de base `zav_test`.
- Cuentas sintéticas `admin.qa` y `vendedor.qa`. Los productos y lotes que aparecen en las capturas fueron creados por el flujo E2E real, exclusivamente en esa base. No son datos incorporados a la UI.
- Next.js en modo producción, API y PostgreSQL locales. Las variables de QA sustituyeron las conexiones de los archivos `.env` solo en los procesos de prueba. No se consultaron ni modificaron bases existentes o remotas.

## Validación técnica final

| Comando | Resultado |
| --- | --- |
| `pnpm --filter @zav/web lint` | Código 0; sin errores ni advertencias de ESLint. |
| `pnpm --filter @zav/web build` | Código 0; compilación en 1986 ms, TypeScript en 6.4 s y generación 6/6 en 1920 ms. |
| `pnpm --filter @zav/web test:e2e` | Código 0; **7 passed (41.8s)**, sin fallos ni reintentos. |
| `git diff --check` | Sin errores de espacios. |

El build genera `/` y `/icon.jpg` estáticos; `/acceso` y `/panel` dinámicos; además de `/_not-found`. No se añadieron dependencias ni cambios al lockfile.

## Ejecuciones y correcciones

1. Antes de ejecutar E2E, TypeScript detectó que el chequeo de imágenes accedía a propiedades de `HTMLImageElement` desde un tipo genérico. Se agregó la comprobación de tipo y el build pasó. También se corrigió una conversión de caracteres de PowerShell durante la edición; se verificaron los textos finales en UTF-8.
2. Primera ejecución: **4 aprobadas, 3 fallidas, 54.3 s**, código 1. El selector de marca se evaluaba antes de completar la navegación desde la portada al acceso, cuando todavía había dos logos visibles. Se espera ahora la URL y el encabezado de destino.
3. Las primeras capturas se tomaban antes de cargar los logos. Se priorizó su carga por estar al inicio de las pantallas y se espera la carga efectiva de imágenes antes de capturar. En la revisión visual también se evitó cortar códigos, fechas y usuarios en las tablas.
4. Un lint posterior a generar el reporte inspeccionó JavaScript distribuido por Playwright: **3054 problemas, 259 errores y 2795 advertencias**, código 1. Se excluyeron solamente `playwright-report/`, `test-results/` y `blob-report/`; la aplicación y las pruebas siguen bajo lint. La repetición terminó con código 0.
5. Segunda ejecución: **4 aprobadas, 3 fallidas, 44.2 s**, código 1. Shift+Tab desde el primer control del diálogo podía sacar el foco. Se implementó el recorrido circular por controles visibles y habilitados, manteniendo el diálogo nativo.
6. Tercera ejecución: **7 aprobadas, 0 fallidas, 42.9 s**, código 0. Se verificaron los flujos completos y se revisaron sus capturas.
7. La revisión final de capturas detectó redacción inadecuada con conteos de un solo registro. Se ajustaron los rótulos del catálogo y el alcance del resumen, y se repitieron lint, build y la suite completa para que las evidencias correspondan al texto final.
8. Ejecución final: **7 aprobadas, 0 fallidas, 41.8 s**, código 0. `test-results/.last-run.json` registra `status: passed` y `failedTests: []`.

Los avisos de Node sobre `NO_COLOR` y `FORCE_COLOR` son de formato de consola; no son errores de la aplicación ni de ESLint. No se declara ejecutado GitHub Actions en esta rama: la validación fue local y no se hizo push.

## Cobertura de las siete pruebas

1. Portada con identidad de ZAV y redirección del panel sin sesión.
2. Login, resumen, catálogo vacío, alta de producto y lote, traslado de 5 de 12 unidades, saldos 7/5, liberación, bloqueo, historial, persistencia después de recargar y cierre de notificación.
3. Inicio, acceso, cinco módulos, cuatro modales y logout a **390 × 900**.
4. Mismo recorrido a **768 × 900**.
5. Mismo recorrido a **1440 × 900**.
6. Enlace de salto, foco visible, contraste de texto de al menos **4.5:1** en botones primarios, navegación lateral, encabezados/celdas, códigos, badges y rótulos cubiertos; respeto de movimiento reducido.
7. Error de credenciales inválidas legible y accesible.

Las pruebas responsive verifican ausencia de desborde horizontal de la página, marca cargada, selección con `aria-current`, límites del modal, Tab/Shift+Tab, Escape, retorno de foco, mostrar/ocultar contraseña, cierre de sesión y ausencia de excepciones JavaScript (`pageerror`). Las tablas y la navegación horizontal pueden desplazarse dentro de sus propias regiones.

## Evidencias y revisión visual

La suite genera **47 capturas** en `apps/web/test-results/evidencias/`. Se versiona una selección de **15 PNG** en `docs/pruebas/evidencias/identidad-zav/`, sin alterar su contenido.

| Archivo | Revisión |
| --- | --- |
| [identidad-inicio-1440.png](evidencias/identidad-zav/identidad-inicio-1440.png) | Portada de escritorio y etiqueta ZAV. |
| [identidad-inicio-390.png](evidencias/identidad-zav/identidad-inicio-390.png) | Portada móvil. |
| [identidad-acceso-1440.png](evidencias/identidad-zav/identidad-acceso-1440.png) | Acceso de escritorio. |
| [identidad-acceso-390.png](evidencias/identidad-zav/identidad-acceso-390.png) | Acceso móvil y foco. |
| [identidad-resumen-1440.png](evidencias/identidad-zav/identidad-resumen-1440.png) | Resumen con cifras de la base de QA. |
| [identidad-resumen-390.png](evidencias/identidad-zav/identidad-resumen-390.png) | Resumen móvil y salida de sesión. |
| [identidad-productos-1440.png](evidencias/identidad-zav/identidad-productos-1440.png) | Tabla del catálogo. |
| [identidad-productos-vacio.png](evidencias/identidad-zav/identidad-productos-vacio.png) | Estado vacío real antes de registrar datos. |
| [identidad-modal-productos-390.png](evidencias/identidad-zav/identidad-modal-productos-390.png) | Formulario móvil. |
| [identidad-modal-lotes-768.png](evidencias/identidad-zav/identidad-modal-lotes-768.png) | Formulario de lote en tableta. |
| [identidad-lotes-1440.png](evidencias/identidad-zav/identidad-lotes-1440.png) | Ubicaciones, saldos y condición. |
| [identidad-condiciones-1440.png](evidencias/identidad-zav/identidad-condiciones-1440.png) | Condiciones e historial sin selección. |
| [07-traslado-registrado.png](evidencias/identidad-zav/07-traslado-registrado.png) | Movimiento real y notificación de éxito. |
| [09-lote-bloqueado.png](evidencias/identidad-zav/09-lote-bloqueado.png) | Historial de condición y colores semánticos. |
| [identidad-acceso-error.png](evidencias/identidad-zav/identidad-acceso-error.png) | Error de acceso. |

También quedan disponibles localmente el reporte HTML (`apps/web/playwright-report/index.html`), trazas y resultados (`apps/web/test-results/`). Los intentos anteriores se conservaron en `apps/web/blob-report/identidad-intento-1.zip`, `identidad-intento-2.zip` e `identidad-intento-3-aprobado.zip`. Estas carpetas ya estaban excluidas de Git; no se eliminaron evidencias históricas del proyecto.

Se comprobó visualmente la marca completa, el negro de la etiqueta, la jerarquía de lectura, la separación de estados semánticos y la composición de los cinco módulos. No quedan mockups, cifras decorativas, gradientes, glassmorphism ni iconos de marca improvisados.

## Reproducción

Usar el procedimiento del workflow existente `.github/workflows/qa-web-playwright.yml`: PostgreSQL local aislado `zav_test`, variables sintéticas de QA, fixture de preparación, build API, lint/build web y `pnpm --filter @zav/web test:e2e`. Las pruebas de inventario esperan comenzar con el fixture limpio. No ejecutar ese fixture contra bases de trabajo.

En esta máquina se utilizó un script temporal de PowerShell para inicializar un clúster nuevo, comprobar puertos libres, definir las variables de QA, invocar el fixture y ejecutar Playwright. El cierre de PostgreSQL se ejecuta en `finally`; Playwright gestiona y detiene los dos servidores web. Las variables `NODE_ENV` y `PORT` se declaran mediante `webServer.env`, compatible con Windows y Linux.

Se comprobó al terminar que los puertos 3000, 3001 y 55432 no conservan procesos escuchando. La revisión automática rechazó la eliminación recursiva de una copia de los binarios temporales (`blocked by policy`); quedan archivos de herramientas y el clúster de QA detenido bajo `%TEMP%\zav-identidad-qa`, fuera del repositorio. El ZIP descargado sí se eliminó.

## Revisión manual antes del PR

- Validar la marca contra un original vectorial o manual corporativo cuando exista. Los PNG/JPG actuales son referencias provisionales.
- Probar Safari/WebKit, Firefox, lector de pantalla y dispositivos táctiles reales. Esta ejecución automatizada utilizó Chromium; no constituye una auditoría WCAG completa.
- Revisar tablas con los códigos y nombres reales más largos y con el volumen habitual de trabajo. El límite existente de 30 registros se conserva y se declara en el resumen; no se agregó paginación nueva.
- El script de API y las cinco referencias que ya estaban sin seguimiento al inicio siguen fuera de estos commits.

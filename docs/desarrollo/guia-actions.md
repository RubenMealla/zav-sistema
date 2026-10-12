# Guía de GitHub Actions

Los nombres visibles de las automatizaciones están numerados para encontrar primero las comprobaciones habituales. **Los nombres de los archivos y el historial de ejecuciones se conservan.** Los números solo ayudan a navegar; no representan prioridad de desarrollo.

## Workflows

| En Actions | Archivo | Uso |
|---|---|---|
| 01 · Calidad — API | `qa-backend.yml` | Lint, build, unitarias y E2E con PostgreSQL aislado |
| 02 · Calidad — Web | `qa-web-playwright.yml` | Build y pruebas Playwright de la web y su integración con la API |
| 03 · Calidad — Móvil | `qa-mobile.yml` | Lint y TypeScript de React Native |
| 04 · Android — Compilación APK | `qa-mobile-apk.yml` | Genera y comprueba APK firmado y SHA-256 |
| 05 · Monitoreo — Web y API | `verificacion-publica-e4.yml` | Comprobación pública aproximadamente cada hora; puede crear una issue de alerta |
| 06 · QA especial — Pedidos y recuperación | `qa-recuperacion-rendimiento.yml` | Ensayo aislado con pedidos sintéticos y restauración |
| 07 · Evidencias históricas — Android E3 | `evidencias-movil-qa.yml` | Capturas Android de la entrega E3; depende de un APK histórico |
| 08 · Medición histórica — Rendimiento E4 | `medicion-rendimiento-e4.yml` | Medición de una ruta pública; no mide toda la aplicación |
| 09 · Comprobación histórica — API E3 | `smoke-publico-e3.yml` | Ensayo público usado en la entrega E3 |
| 10 · Publicación histórica — APK 1.0.0 | `publicar-apk-versionado.yml` | Publicación original de la versión 1.0.0, no se reutiliza para otra versión |

## Cuándo se ejecutan

- **01, 02 y 03:** una vez por actualización del PR dirigido a `main` si los archivos afectados coinciden, y una vez al integrar los cambios en `main`. Se eliminan las ejecuciones duplicadas por `push` a ramas de desarrollo que ya cuentan con PR.
- **04:** cuando un PR modifica la aplicación Android, cuando cambian archivos móviles en `main`, o al ejecutarlo manualmente. En ramas distintas de `main` usa canal **QA**, incluso con `workflow_dispatch`. En `main` utiliza canal **release**; no publica automáticamente una nueva versión en GitHub Releases.
- **05:** conserva el monitoreo programado de `main` y la lógica de apertura/cierre de alertas.
- **06 a 10:** pruebas, evidencias o publicación específicas. Conservar las ejecuciones anteriores; revisar el propósito y los valores fijos antes de iniciarlas manualmente.

## Cómo comprobar una revisión

1. Abrir **Pull requests** y entrar en el PR vigente; verificar el último commit.
2. En **Checks** comprobar 01, 02, 03 y 04 cuando corresponda. Una ejecución verde de otro commit no sustituye la comprobación del último.
3. Abrir cada ejecución fallida, entrar en el trabajo y consultar el paso exacto que falló. Corregir la causa antes de repetir.
4. Buscar APK, reportes y capturas en **Artifacts** de la ejecución correspondiente. Los artefactos temporales suelen tener retención de 30 días.
5. Para la versión 1.0.0, consultar el APK persistente en **Releases** y su archivo SHA-256.

## Seguridad y conservación

- No ejecutar pruebas contra Neon `production`; las suites de integración utilizan PostgreSQL de QA.
- Las compilaciones Android de QA no deben tener una URL de producción. La configuración opcional `ZAV_QA_API_BASE_URL` debe apuntar a un entorno aislado y accesible desde Android.
- `10.0.2.2` es la IP especial del emulador Android para conectarse a la PC anfitriona; un celular físico requiere una URL distinta.
- **07** descarga un APK concreto de una ejecución histórica, que podría caducar; no representa una suite general para cualquier APK nuevo.
- **10** tiene datos fijos de la versión 1.0.0 y debe permanecer como registro de ese lanzamiento. No reutilizarlo para nuevas versiones.
- No borrar workflows, ramas, commits, PR, ejecuciones ni artefactos para mejorar artificialmente el historial. Los fallos antiguos son parte de las evidencias del desarrollo.
- No interpretar trabajos cancelados automáticamente por nuevos commits como fallos del último código; comprobar el SHA y el estado final.

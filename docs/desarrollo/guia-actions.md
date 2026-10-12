# Guía de GitHub Actions

Para revisar una mejora nueva, comienza en [PR #71](https://github.com/RubenMealla/zav-sistema/pull/71) → **Checks**. Los seis workflows operativos se encuentran en `.github/workflows/`. Los cuatro antiguos de E3 y E4 se conservan como archivos de referencia en `docs/historico/workflows/`, pero no se ejecutan desde esa carpeta.

**Importante:** GitHub puede seguir mostrando nombres de workflows históricos en el menú de Actions aunque se retiren sus archivos. No se eliminarán ejecuciones, artefactos, ramas, commits ni PR para ocultarlos.

## Workflows operativos

| Nombre visible | Archivo | Función |
|---|---|---|
| 01 · Calidad — API | `qa-backend.yml` | Lint, build, pruebas unitarias y E2E contra PostgreSQL aislado |
| 02 · Calidad — Web | `qa-web-playwright.yml` | Lint, compilación y Playwright |
| 03 · Calidad — Móvil | `qa-mobile.yml` | Lint y TypeScript móvil |
| 04 · Android — Compilación APK | `qa-mobile-apk.yml` | APK firmado y verificación de identidad e integridad |
| 05 · Monitoreo — Web y API | `verificacion-publica-e4.yml` | Comprobación pública periódica y alerta |
| 06 · QA especial — Pedidos y recuperación | `qa-recuperacion-rendimiento.yml` | Ensayo aislado de carga y restauración |

## Workflows históricos archivados

| Archivo conservado en `docs/historico/workflows/` | Propósito |
|---|---|
| `evidencias-movil-qa.yml` | Capturas Android E3 asociadas a un APK de ejecución histórica |
| `medicion-rendimiento-e4.yml` | Medición pública del periodo E4 |
| `smoke-publico-e3.yml` | Verificación pública empleada en E3 |
| `publicar-apk-versionado.yml` | Publicación original firmada de ZAV Vendedor 1.0.0; no reutilizar para otros lanzamientos |

## Cuándo se ejecutan

- **01, 02 y 03:** en PR a `main` cuando los archivos afectados coinciden, tras integrar en `main`, o manualmente con **Run workflow** desde la rama seleccionada. No duplican la misma prueba por `push` a una rama de desarrollo que ya tiene PR.
- **04:** cuando un PR modifica la aplicación Android, cuando cambian archivos móviles en `main`, o al ejecutarlo manualmente. En ramas distintas de `main` usa canal **QA**, incluso con `workflow_dispatch`. En `main` utiliza canal **release**; no publica automáticamente una nueva versión en GitHub Releases.
- **05:** conserva el monitoreo programado de `main` y la lógica de apertura/cierre de alertas.
- **06:** ensayo especializado manual o disparado por cambios definidos en su YAML. **07 a 10:** scripts archivados, sin ejecución activa; conservar sus resultados y no restaurarlos automáticamente.

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
- El histórico de capturas Android E3 descargaba un APK concreto de una ejecución que puede caducar; no constituye una suite general para cualquier APK nuevo.
- El histórico de publicación original tiene datos fijos de la versión 1.0.0; se conserva como registro, no para publicar otras versiones.
- No borrar registros de ejecuciones, ramas, commits, PR ni artefactos para mejorar artificialmente el historial. Los cuatro YAML históricos se trasladaron con su contenido intacto a documentación. Los fallos antiguos son parte de las evidencias del desarrollo.
- No interpretar trabajos cancelados automáticamente por nuevos commits como fallos del último código; comprobar el SHA y el estado final.

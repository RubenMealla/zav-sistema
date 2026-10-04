# ZAV Vendedor 1.0.0

**Fecha de aceptación:** 4 de octubre de 2026  
**Estado:** versión funcional inicial validada físicamente  
**Alcance:** aplicación móvil operativa del rol Vendedor

## Identificación

| Elemento | Valor |
| --- | --- |
| Nombre visible | ZAV Vendedor |
| Versión | 1.0.0 |
| Android versionCode | 10000 |
| iOS buildNumber | 10000 |
| Package / bundle | `bo.zav.gestion.vendedor` |
| Slug Expo | `zav-vendedor` |
| Scheme | `zav-vendedor` |

## Criterio de versión

Se utiliza versionamiento semántico:

- **MAJOR**: cambios incompatibles o rediseño de alcance.
- **MINOR**: funcionalidades nuevas compatibles.
- **PATCH**: correcciones compatibles.

La primera versión estable del alcance implementado se identifica como **1.0.0**.

## Artefacto Android

GitHub Actions genera el binario firmado con nombre:

`ZAV-Vendedor-1.0.0-build10000-qa.apk` en pull requests y `ZAV-Vendedor-1.0.0-build10000-release.apk` en `main`.

Cada APK se publica junto con su archivo `.sha256` correspondiente.

El artefacto de Actions incorpora además el número de ejecución para diferenciar recompilaciones de una misma versión.

## Evidencia de aceptación

El estudiante confirmó en dispositivo Android que los flujos comprometidos de esta versión funcionan de manera estable para el alcance E3. Los detalles de las validaciones iterativas se conservan en `docs/pruebas/verificacion-app-movil-e3.md`.

## Observación de trazabilidad

La versión 1.0.0 debe asociarse al commit resultante de fusionar el PR E3 en `main`. Las mejoras posteriores deben incrementar la versión conforme al tipo de cambio y conservar esta entrada como antecedente, sin reescribirla.


## Canales de compilación

- **qa:** se genera desde pull requests y utiliza `https://zav-api-e3-dev.onrender.com`.
- **release:** se genera al integrar cambios en `main` y utiliza `https://zav-api-2026.onrender.com`.

Esta separación evita distribuir como versión estable un APK conectado al entorno de desarrollo.

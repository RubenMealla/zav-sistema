# Workflows históricos del sistema ZAV

Aquí se conservan **copias íntegras** de los cuatro workflows de las entregas E3 y E4 retirados de `.github/workflows/` durante la organización de la rama `mejora/calidad-arquitectura`.

Estos archivos en `docs/historico/workflows/` **no se ejecutan** automáticamente ni mediante el botón **Run workflow**. No se deben tratar como pruebas vigentes de la versión nueva.

Se conserva su historial en Git, sus commits originales, ramas, solicitudes de integración y ejecuciones en GitHub Actions. Los nombres históricos podrían seguir visibles en la barra lateral de Actions.

- `evidencias-movil-qa.yml`: capturas Android del periodo E3 con APK preexistente.
- `medicion-rendimiento-e4.yml`: medición puntual de API de E4.
- `smoke-publico-e3.yml`: verificaciones públicas de E3.
- `publicar-apk-versionado.yml`: publicación única de ZAV Vendedor 1.0.0; la publicación firmada se mantiene en GitHub Releases.

El procedimiento vigente figura en [Guía de GitHub Actions](../../desarrollo/guia-actions.md). Para nuevas versiones Android se deberá configurar una nueva publicación y adaptar las evidencias de QA, no reactivar directamente el workflow fijo de 1.0.0.

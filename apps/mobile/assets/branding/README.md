# Identidad móvil ZAV Vendedor

## Decisión de producto

- Nombre visible: **ZAV Vendedor**
- Alcance: aplicación móvil operativa exclusiva del rol **Vendedor**
- Versión estable inicial: **1.0.0**
- Código interno Android/iOS: **10000**
- Identificador de aplicación: `bo.zav.gestion.vendedor`
- Slug Expo: `zav-vendedor`
- Esquema de enlace: `zav-vendedor`

El nombre **ZAV Vendedor** se mantiene porque identifica de forma directa la empresa y el actor al que pertenece la aplicación. Evita nombres ambiguos como “ZAV Ventas”, ya que la app también gestiona Clientes, Pedidos, retiro, distribución y comprobación GPS.

## Iconografía

- `assets/images/icon.png` es el recurso de ejecución para launcher, adaptive icon, splash y favicon.
- `assets/branding/zav-vendedor-icon.svg` conserva la apariencia del icono premium aprobado como recurso maestro de marca.
- La identidad aprobada usa fondo oscuro, cerdo naranja y logotipo ZAV blanco.
- Los recursos gráficos heredados de la plantilla Expo fueron eliminados del proyecto.
- El workflow del APK falla si detecta nuevamente logos, tabs o tutoriales residuales de la plantilla.

## Versionamiento

ZAV Vendedor adopta versionamiento semántico:

- **MAJOR**: cambios incompatibles o rediseños mayores.
- **MINOR**: nuevas capacidades compatibles.
- **PATCH**: correcciones sin alterar contratos funcionales.

Para la primera versión: `1.0.0 → 10000`.

La codificación interna reserva dos dígitos para MINOR y PATCH:

- `1.0.1 → 10001`
- `1.1.0 → 10100`
- `2.0.0 → 20000`

El código de build debe incrementarse siempre en una publicación posterior.

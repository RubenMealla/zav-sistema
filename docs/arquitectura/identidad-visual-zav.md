# Identidad visual web de ZAV

Referencia: [Issue #25](https://github.com/RubenMealla/zav-sistema/issues/25). Rama: `desarrollo/identidad-visual-zav`.

## Criterio de diseño

La interfaz toma como punto de partida la etiqueta de los fiambres y embutidos: fondo negro, marca naranja y blanca, contorno fino y composición frontal. La portada funciona como entrada institucional al sistema interno. Se retiró el panel simulado y sus indicadores decorativos. No se incorporaron ventas, pedidos, clientes, producción ni datos de demostración a la aplicación.

En administración se priorizan superficies claras, tablas legibles, controles de 44 px y navegación oscura. El resumen utiliza una franja de cifras y accesos en filas, sin gráficos ni tarjetas ornamentales. Los agregados de condición y existencia indican que se calculan sobre los lotes consultados, cuyo límite existente es 30; los totales proceden de la API.

## Uso de las cinco referencias

Las cinco imágenes originales/de referencia se conservan versionadas en `docs/referencias/identidad-zav` como evidencia de diseño. Sus nombres usan extensiones simples y su contenido se mantiene intacto.

| Referencia | Uso y decisión |
| --- | --- |
| `01-logo-original-zav.jpg` | Fuente del componente de marca compacto y del icono del sitio. Se conserva el cerdo naranja, el lettering ZAV y la denominación original. Copia íntegra en `apps/web/public/marca/logo-zav.jpg`; no se redibujó. |
| `02-etiqueta-empaque-original-zav.jpg` | Referencia de composición: cinta negra, borde blanco y contraste. La madera es el entorno del empaque, no el color de la cinta. No se usa la fotografía como fondo de la aplicación. |
| `03-publicacion-productos-colores-zav.jpg` | Confirma el contexto de productos envasados y la presencia del naranja. Se conserva esa relación de color sin trasladar el amarillo promocional, el teléfono, el saludo ni la textura a una pantalla operativa. |
| `04-logo-limpio-referencia-zav.png` | Se comparó con el original. Presenta artefactos visibles en el lettering y no se eligió como asset de producción. Sirve para comprobar proporciones y disposición, sin corregir ni inventar una nueva marca. |
| `05-etiqueta-limpia-referencia-zav.png` | Copia íntegra en `apps/web/public/marca/etiqueta-zav.png`, usada en la portada y acceso. Su marco blanco da identidad a la composición. Se trata como material provisional de referencia, no como vector corporativo certificado. |

Los assets que utiliza directamente la aplicación están en `apps/web/public/marca`, versionados con el frontend. Los JPG/PNG siguen siendo materiales provisionales y no sustituyen un manual de marca o un vector corporativo oficial. `next/image` sirve versiones ajustadas al tamaño de visualización. El encuadre CSS elimina margen negro sobrante sin modificar los archivos originales.

## Sistema visual

- Naranja referencial: `#E75629`, para identificación, reglas y acentos. No se presenta como valor oficial.
- Naranja de acción: `#B83B17`; hover `#963011`. La variante oscura permite texto blanco legible en botones y texto de marca sobre fondos claros.
- Carbón: `#20201E` y `#151513`; negro puro bajo las imágenes originales para evitar marcos accidentales.
- Superficie: `#F6F5F0`; blanco para tablas y formularios. Los neutros cálidos son leves, sin predominio marrón.
- Éxito/liberado: `#286344`; advertencia/retenido: `#795410`; error/bloqueado: `#A1322C`; información/movimiento: `#2B5E85`. Los estados siempre incluyen texto.
- Tipografía de sistema (`Segoe UI`, alternativas nativas), con Georgia en titulares públicos para relacionarlos con el carácter tipográfico de la etiqueta. Consolas para códigos y cifras tabulares para cantidades. Sin descargas de fuentes.
- Radios de 4 px; 6 px en diálogos. Bordes antes que sombras; sombras limitadas a superficies superpuestas. Transiciones de 150 ms y respeto de `prefers-reduced-motion`.

## Organización del frontend

`globals.css` contiene tokens, base, botones y foco. `estilos/` separa portada, acceso, estructura administrativa, controles y adaptación del panel. Las clases existentes se conservan donde aportan continuidad; se eliminaron los estilos del mockup y las decoraciones anteriores.

`componentes/marca.tsx` centraliza las dos presentaciones de la marca; sus reglas están encapsuladas en CSS Modules. `panel/marco-panel.tsx` reúne sidebar, topbar y navegación móvil como componente de servidor. La carga de datos y las acciones de inventario conservan sus rutas y contratos.

`componentes/interacciones.tsx` concentra diálogos nativos, contraseña, notificaciones y envío pendiente. Los diálogos tienen nombre y descripción accesibles, cierre con Escape y retorno de foco nativos. Un control de los extremos de Tab/Shift+Tab mantiene el recorrido circular entre los campos habilitados. Los avisos permanecen hasta cerrarlos o navegar: no desaparecen antes de terminar de leerlos. Los botones de envío muestran el estado pendiente y previenen envíos repetidos mientras dura la solicitud.

La navegación móvil incluye marca y cierre de sesión. Las tablas tienen título accesible, encabezados asociados y una región desplazable por teclado. La página completa no debe desbordarse horizontalmente. La navegación conserva `aria-current` en ambas presentaciones.

## Límites deliberados

No se añadieron dependencias, cambios de backend, endpoints, migraciones ni reglas de negocio. No se implementó paginación nueva: los listados mantienen el límite previo. La identidad queda pendiente de contrastar con un original vectorial y un manual corporativo cuando estén disponibles. Los resultados de ejecución y evidencias se documentan por separado en `docs/pruebas/identidad-visual-zav.md`.

# Revisión de mantenimiento 1.1.1

Rama `mantenimiento/limpieza-seguridad-imagenes`, desde `main` en `e2a9d19b6accdcc23f026a1e8c9197bd4b587b3e`. [Issue #76](https://github.com/RubenMealla/zav-sistema/issues/76) y [PR #77](https://github.com/RubenMealla/zav-sistema/pull/77). La revisión permanece separada de producción, sin fusionar ni reescribir historial.

## Cambios

- Un selector de fotografía compartido por los formularios de familias y productos: vista previa proporcional, seleccionar/cambiar, deshacer, carga visible y guardado bloqueado mientras se valida el archivo. Un fallo conserva la fotografía anterior y permite reintentar.
- Retiro de los formularios anteriores de producto y sus acciones sin consumidores, funciones móviles sin llamadas y cuatro dependencias sin uso. Los formularios de lotes, movimientos, catálogo, pedidos y ventas siguen activos.
- Se conservan las dependencias nativas usadas indirectamente por Expo Router. `knip.json` documenta esos puntos de entrada y scripts operativos.
- Se archivaron configuraciones auxiliares y archivos locales de herramientas fuera del árbol de trabajo. No se eliminaron ramas, commits, evidencias, referencias bibliográficas ni originales gráficos.
- La candidata `1.1.1-rc.2`, build Android/iOS `10106`, incorpora parches posteriores al APK `1.1.1-rc.1`/`10105`; ambas identidades quedan diferenciadas.

## Credenciales y entornos

En el árbol versionado solo se mantienen las tres plantillas `.env.example`. La API local ahora usa una base de desarrollo en `127.0.0.1`, distinta de la base descartable `zav_test`. Web y móvil no reciben secretos PostgreSQL ni JWT. La separación por aplicación evita compartir claves privadas con clientes públicos; no conviene reunir todo en un único `.env` global.

Se contrastaron dos secretos de la configuración local original con 1544 blobs del historial alcanzable, sin coincidencias. Gitleaks identificó seis JWT sintéticos históricos de pruebas locales y un nombre de migración que produjo un falso positivo. Las siete excepciones usan huellas exactas; no excluyen archivos completos. El escaneo posterior no tuvo hallazgos nuevos. No constituye una garantía absoluta de ausencia de secretos.

Los workflows generan claves y contraseñas sintéticas por ejecución y las enmascaran. El control `security:files` rechaza entornos privados, claves, respaldos y archivos auxiliares versionados; el workflow 07 examina el historial. Un ensayo aislado comprobó que ambos controles rechazan una credencial sintética y un `.env` añadido a Git.

Las copias originales de configuración están en `C:\Users\Ruben\Respaldo-ZAV\limpieza-2026-11-06`, con manifiestos SHA-256. Este respaldo local contiene secretos: no se adjunta al PR ni se publica. Véase [organización de entornos](../desarrollo/entornos.md).

## Dependencias

El análisis inicial del 6 de noviembre registró 25 avisos en el grafo de producción: 2 críticos, 11 altos, 8 moderados y 4 bajos. Se actualizó Next.js de 16.3.8 a 16.4.1, NestJS de 12.0.3 a 12.3.3 y se resolvieron parches compatibles de `multer`, `body-parser`, `qs` y `node-forge`.

El análisis del 9 de noviembre, tras esos cambios, conserva 7 avisos: **0 críticos, 2 altos, 4 moderados y 1 bajo**. Todos los caminos restantes parten de dependencias móviles de Expo. No se forzaron versiones mayores incompatibles para ocultar alertas.

| Dependencia indirecta | Aviso pendiente | Contexto |
|---|---|---|
| `zod` 3.25.76 | Alto, GHSA-mrhx-c7xc-m3w5 | CLI de Expo; el parche anunciado está en 4.6.6 |
| `decode-uri-component` 0.2.2 | Alto y moderado, GHSA-qr28-fpjm-wq7f / GHSA-vcc3-ghjq-m6fr | `query-string` de Expo Router; decodificación de rutas, requiere revisión de compatibilidad |
| `glob` 13.0.6 | Moderado, GHSA-3g3m-2fjr-6pw4 | Herramientas de configuración de Expo |
| `minimatch` 10.2.6 | Moderado, GHSA-g3hv-75wg-m249 | Dependencia de `glob` |
| `uuid` 7.0.3 | Moderado, GHSA-w5hq-g745-h8pq | Generación del proyecto Xcode |
| `deepmerge` 4.3.1 | Bajo, GHSA-gcqx-w48m-w2h4 | Configuración de Expo; sin parche informado |

El [issue #72](https://github.com/RubenMealla/zav-sistema/issues/72) conserva el seguimiento. Un aviso en herramientas de compilación no demuestra explotación de la API; tampoco se declara inocua la decodificación móvil. Las actualizaciones del SDK requieren su propia comprobación antes de cerrar ese seguimiento.

Referencias primarias: [Next.js SVG](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [Next.js caché](https://github.com/advisories/GHSA-673q-mjm6-r5xr), [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) y [decode-uri-component](https://github.com/advisories/GHSA-qr28-fpjm-wq7f).

## Verificación y recuperación

Con las dependencias actualizadas se verificaron compilación de API y web, 26 pruebas unitarias de API, 69 pruebas de integración con PostgreSQL local y 20 pruebas móviles. La primera ejecución de integración falló porque PostgreSQL local estaba detenido después de la interrupción; al reiniciar la misma instancia aislada, pasaron las 69. Se conservan ambos registros.

La revisión anterior `38e5141` pasó además las 44 pruebas de navegador y los seis workflows de GitHub Actions, incluidos APK y comprobaciones Android. Los resultados correspondientes al último commit y sus artefactos se enlazan en el PR; no se atribuye una ejecución anterior a un commit nuevo.

El commit `e43f798` pasó las 44 pruebas de navegador en Actions. La inspección posterior de la captura desplegada detectó recorte de una fotografía cuadrada por el tamaño intrínseco de la imagen dentro de la cuadrícula CSS. Se ajustó su encaje al marco y se ampliaron las dos pruebas de fotografías para comprobar sus límites en escritorio y móvil; ambas pasaron localmente. Este ajuste solo afecta a la web; el APK build 10106 proviene de `e43f798` y mantiene exactamente el mismo código y dependencias móviles.

No hay migraciones nuevas ni transformación de datos empresariales en esta revisión. Las once migraciones existentes se ensayaron en una base local de desarrollo vacía. Producción conserva `1.1.0` y sus conexiones. Los despliegues de prueba y APK no autorizan merge.

La API QA de Render conserva el commit `86f49788a789ae299151d3ce2ab5e7488d23a3b6`, despliegue `dep-dbl72s61egvs73dvklkg`, servicio `srv-dbj4ia8u01pc73ef4850`. El conector disponible permite disparar despliegues de su rama configurada, pero no cambiar esa rama ni seleccionar un commit; tampoco estuvo disponible la conexión de interfaz al navegador. Por tanto, las pruebas locales y de CI de NestJS actualizado no se presentan como verificación de un despliegue nuevo en Render. La web y el APK QA conservan el contrato compatible con esa API. Para completar esa comprobación remota, configurar únicamente este servicio QA con la rama de mantenimiento y verificar su versión y conexión QA después del despliegue.

Para retirar esta candidata basta volver al despliegue previo de cada aplicación; no hace falta restaurar datos por cambios de esquema. No desinstalar el APK QA con operaciones locales pendientes. Los respaldos de configuración permiten recuperar archivos locales concretos, comprobando su manifiesto y destino antes de copiar; no restaurar por defecto la conexión productiva en el entorno diario.

## Revisión manual

1. Entrar en la web de prueba y abrir Catálogo → Familias o Productos → Crear/Editar.
2. Seleccionar una fotografía PNG, JPEG o WebP de hasta 5 MB; comprobar la vista previa, cambiarla y deshacer el cambio.
3. Guardar y volver a abrir: debe mostrarse la imagen guardada. Un archivo incorrecto debe generar aviso y conservar la foto anterior.
4. Revisar el formulario en pantalla estrecha. Pedidos, inventario y venta directa conservan sus recorridos.
5. Instalar únicamente el APK QA de esta candidata para probar la aplicación sin escribir en producción.

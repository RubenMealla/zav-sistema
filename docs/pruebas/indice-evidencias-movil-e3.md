# Índice de evidencias móviles E3 — Android (8 de octubre de 2026)

**Origen verificable:** [GitHub Actions, QA Android #107](https://github.com/RubenMealla/zav-sistema/actions/runs/37735143684), archivo descargable `evidencias-movil-qa-107`. Fotografías/capturas generadas por ADB directamente en el emulador Android con el APK ZAV Vendedor instalado. No son reconstrucciones gráficas.

**Ambiente:** API NestJS en `127.0.0.1:3001`, PostgreSQL temporal aislado, cuentas y pedidos sintéticos. Es evidencia de pruebas técnicas, **no de operaciones reales de ZAV ni de la API pública**. El archivo incorpora `RESUMEN-SUITE-ANDROID.txt` y reportes JSON por caso.

| Imagen | Acción observada en Android | Cobertura |
| --- | --- | --- |
| MOV-01-acceso-vendedor.png | Formulario de ingreso | RF-02 |
| MOV-02-validacion-login.png | Rechazo de campos vacíos | RF-02, camino de error |
| MOV-03-error-login-401.png | Rechazo de credenciales incorrectas HTTP 401 | RF-02, camino de error |
| MOV-04-pedidos.png | Pantalla autenticada del Vendedor | RF-02 / RF-08 |
| MOV-05-nuevo-pedido.png | Formulario de pedido | RF-07 |
| MOV-06-selector-clientes.png | Selector de clientes | RF-07 |
| MOV-07-selector-productos.png | Selector de productos | RF-07 / RF-14 |
| MOV-08-validacion-pedido.png | Datos incompletos rechazados | RF-07, camino de error |
| MOV-09-clientes.png | Formulario/directorio de clientes | RF-06 |
| MOV-10-validacion-cliente.png | Rechazo de datos incompletos | RF-06, camino de error |
| MOV-11-mapa-cliente.png | Interfaz del mapa para seleccionar ubicación (no acredita alta exitosa) | RF-06 |
| MOV-12-pedidos-acciones.png | Acciones disponibles sobre pedidos activos | RF-08 |
| MOV-13-formulario-pedido-completo.png | Formulario completo previo al registro | RF-07, camino correcto |
| MOV-14-pedido-registrado-ui.png | Confirmación del registro, con verificación de incremento en API | RF-07, camino correcto |
| MOV-15-confirmacion-retiro.png | Confirmación de custodia previa al retiro | RF-09, camino correcto |
| MOV-16-retiro-realizado.png | Retiro confirmado y cambio de estado comprobado en API | RF-09, camino correcto |
| MOV-17-cliente-sin-ubicacion-rechazado.png | Rechazo de cliente sin ubicación y ausencia de inserción en API | RF-06, camino de error |
| MOV-18-confirmacion-anulacion.png | Diálogo antes de anular un pedido registrado | RF-11 |
| MOV-19-pedido-anulado.png | Anulación confirmada y transición de estado comprobada | RF-11, camino correcto |
| MOV-20-recorrido-organizado.png | Recorrido organizado con dos pedidos sintéticos | RF-12, camino correcto |
| MOV-21-mapa-recorrido-android.png | Mapa completo del reparto tras organizar desde ZAV | RF-12, camino correcto |

**Resultado de la suite #107:** seis casos independientes correctos y ninguno fallido. La planificación se comprobó además con dos paradas y `VECINO_MAS_CERCANO_HAVERSINE` en el backend de QA.

**Evidencias todavía requeridas para cobertura integral:** confirmación de entrega con GPS en Android (RF-10), cliente registrado con punto confirmado (RF-06), edición de pedido (RF-07), retiro múltiple y rechazos de estados incompatibles (RF-09) e incorporación de pedidos al reparto (RF-12). No declarar estos casos como probados antes de ejecución y reporte verificables.

Para la monografía, cada caso se relacionará con **resultado esperado, resultado obtenido, imagen y ejecución verificable**. Mantener dos imágenes por hoja solo cuando su legibilidad lo permita. No presentar una captura de un formulario como prueba de que se guardaron datos.


## Actualización de ejecución #112 (8 de octubre de 2026)

- [Evidencias móviles #112](https://github.com/RubenMealla/zav-sistema/actions/runs/37747697686): seis grupos correctos y séptimo grupo `confirmar_entrega_gps` FALLIDO. La suite global debe considerarse FALLIDA; no confundir capturas parciales con ejecución integral aprobada.
- Archivo original `evidencias-movil-qa-112`: 21 imágenes `MOV-01` a `MOV-21`, dos capturas diagnósticas `MOV-97`, reportes JSON y volcados de accesibilidad. Conservar el artifact como evidencia de evolución, sin insertar los diagnósticos como imágenes de éxito.
- Análisis Android: ubicación habilitada en Settings, pero `dumpsys location` sin última posición en proveedores GPS/fused y sin solicitud de GPS activa. No se mostró `Comprobar entrega`; no se registró `ENTREGADO` mediante el APK.
- [Corrección de diagnóstico GPS](https://github.com/RubenMealla/zav-sistema/commit/669884dabb70777361e5366d4baa19f5be9ad912): prueba con proveedor mock del sistema y captura antes de la espera. El resultado de la ejecución #113 se encuentra pendiente de comprobar; no declarar RF-10 aprobado.

**Pendiente para pasar al documento E3:** además de RF-10, alta efectiva de Cliente con punto confirmado, edición de Pedido y casos negativos representativos de estado/autorización/saldo desde la interfaz móvil. Una prueba API/Swagger no sustituye una captura Android del mismo escenario.


## Casos Android ampliados en desarrollo — NO APROBADOS

Se prepararon scripts de interfaz que se ejecutarán sobre el APK de QA, con PostgreSQL temporal y reportes individualizados. Sus capturas `MOV-24` a `MOV-35` son **nombres reservados**, no imágenes aprobadas todavía.

| Caso | Script | Escenario observable | Verificación obligatoria | Estado |
| --- | --- | --- | --- | --- |
| M-EDICION | `qa-edicion-pedido-android.py` | Corregir observación del pedido registrado | Persistencia de nuevo contenido y estado REGISTRADO | PENDIENTE DE EJECUCIÓN |
| M-CLIENTE | `qa-alta-cliente-android.py` | Registrar cliente desde mapa con GPS ficticio | Cliente nuevo con ubicación confirmada en API aislada | PENDIENTE DE EJECUCIÓN |
| M-CONFLICTO | `qa-conflicto-anulacion-android.py` | Anulación tardía rechazada con HTTP 409 visible | Servidor conserva EN_DISTRIBUCION | PENDIENTE DE EJECUCIÓN |
| M-RETIRO-MULT | `qa-retiro-multiple-android.py` | Selección y retiro de varios pedidos | Cada pedido pasa a EN_DISTRIBUCION y los conteos coinciden | PENDIENTE DE EJECUCIÓN |
| M-NUEVO-RUTA | `qa-nuevo-pedido-recorrido-android.py` | Añadir pedido nuevo sin cancelar ruta | Recorrido conserva paradas y aumenta exactamente una | PENDIENTE DE EJECUCIÓN |

Los scripts simulan precondiciones mediante API de QA cuando se declara expresamente; esto **no equivale a registrar esas precondiciones desde la pantalla**. Las operaciones centrales bajo prueba sí deben ejecutarse mediante el APK. Conservar capturas diagnósticas `MOV-97` separadas de la evidencia aprobada. No alterar el documento E3 hasta revisar los resultados y las imágenes.


## Regresión integral Android #117 — verificada

- [Ejecución #117](https://github.com/RubenMealla/zav-sistema/actions/runs/37753774876) **SUCCESS**; artifact `evidencias-movil-qa-117` (ID `11539567625`).
- El ZIP contiene 23 capturas funcionales `MOV-01`–`MOV-23`, una captura intermedia `MOV-95` y 7 reportes JSON. Se verificaron resultados `CORRECTO` en registro, retiro, validación de cliente sin ubicación, anulación, organización y confirmación de entrega GPS. La captura `MOV-95` no se incorpora como prueba funcional positiva.
- La entrega GPS se ejecutó sobre Android API 33 `google_apis` con coordenadas ficticias. No constituye evidencia de entrega física.
- Los casos ampliados de edición, alta positiva de cliente, anulación concurrente HTTP 409, retiro múltiple, incorporación a ruta y denegación del permiso GPS **siguen PENDIENTES** de ejecución y revisión de artifacts. Ninguna figura `MOV-24`–`MOV-37` se declara aprobada todavía.


| M-GPS-DENEGADO | `qa-gps-denegado-android.py` | Denegar permiso nativo al solicitar entrega | La UI muestra rechazo y ningún pedido cambia a ENTREGADO | PENDIENTE DE EJECUCIÓN |


## Diagnóstico de ejecución ampliada #124 (8 de octubre de 2026)

- [Android #124](https://github.com/RubenMealla/zav-sistema/actions/runs/37755910478) **FALLIDA**. Artifact `evidencias-movil-qa-124`, ID `11541371759`. Resultado: 11 casos operativos, 8 correctos y 3 fallidos; la entrega GPS autorizada se completó, pero no cambia la calificación global de FALLIDA.
- Correctos: registro, retiro individual, validación de cliente sin GPS, anulación, organización, anulación concurrente con HTTP 409, retiro múltiple y entrega denegada por permisos. Sus reportes son verificables por separado. En ningún caso el estado global del workflow acredita automáticamente los casos que fallaron.
- Pendientes: (1) edición de pedido: campo Observación fuera del viewport; (2) alta positiva de cliente: la ventana nativa de permiso de ubicación estaba abierta y el script no la atendía; (3) adición de pedido a ruta: el nuevo pedido sí aparecía entre los activos, pero el control de adición estaba debajo de la vista previa del mapa y fuera de la jerarquía visible.
- Se corrigieron scripts de pruebas y se agregó disparador `qa-*-android.py` y verificación de sintaxis en el workflow. Verificar en [Android #125](https://github.com/RubenMealla/zav-sistema/actions/runs/37759391766); **pendiente de resultado**.
- Estas pruebas usan APK y PostgreSQL aislados, GPS simulado. No son evidencia de entregas físicas ni del despliegue de producción. Se conserva todo el historial de fallos.

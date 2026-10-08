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

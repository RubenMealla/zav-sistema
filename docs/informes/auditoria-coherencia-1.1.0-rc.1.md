# Auditoría de coherencia: 1.0.0 → 1.1.0-rc.1

Revisión del 03/11/2026 solicitada por el propietario. Base estable: `main`, SHA `e9dc1a40476a72034f38e4dabb0e178c62af0066`. Trabajo exclusivo en `desarrollo/ventas-directas-catalogo`; [PR 74](https://github.com/RubenMealla/zav-sistema/pull/74) abierto, sin fusionar. La auditoría compara código, contratos, recorridos e invariantes de datos; no afirma que una batería de pruebas pueda demostrar ausencia absoluta de defectos.

## Dictamen funcional

La ampliación resuelve necesidades distintas del flujo anterior y merece conservarse. Los problemas encontrados estaban en la presentación de información, el manejo de errores y algunas consultas. No corresponde reemplazar el circuito de pedidos, crear otro inventario editable ni añadir facturación o cobros.

| Área | Versión estable | Ampliación y evaluación |
| --- | --- | --- |
| Catálogo | Cada SKU repetía familia y nombre; la landing tenía una lista estática. | Familia agrupa; producto comercial concentra identidad, foto y descripción; presentación identifica el paquete vendible con SKU, peso y precio. Son responsabilidades distintas, incluso cuando hoy hay una sola presentación. |
| Publicación | Los cambios públicos requerían editar React. | El Administrador publica datos mediante el catálogo. Publicado no significa activo ni con stock. Se conservan siete familias y trece productos confirmados. |
| Pedidos | Cliente → pedido → retiro FEFO → distribución → entrega GPS. | Se conserva el recorrido y sus estados. La venta ocasional no exige crear un pedido ni una parada ficticia. |
| Venta directa | No había registro específico de entrega ocasional. | Salida definitiva con lotes, responsable, ubicación y datos históricos. No registra cobro, deuda ni factura. |
| Mercancía del vendedor | EN_DISTRIBUCION identificaba mercancía retirada para pedidos. | Se añade propietario y finalidad LIBRE/PEDIDO. La carga libre no consume reservas ni stock de otro vendedor. Esta separación es necesaria, no otro módulo de pedidos. |
| Recepción y devolución | El flujo principal correspondía a pedidos comprometidos. | La recepción acredita la entrega física de la carga. La devolución inmoviliza sobrantes y requiere recepción administrativa hacia inspección. No se reintegra automáticamente mercancía no vendible. |
| Inventario | Movimientos y saldo derivado. | Sigue existiendo una sola fuente: `movimiento`. La custodia y los saldos se calculan con vistas; no son cantidades editables por separado. |
| Interfaz | Modales, confirmaciones y avisos flotantes compartidos. | Se reutilizan esas interacciones en las funciones nuevas. Venta, historial, detalle, carga y devolución tienen vistas o ventanas separadas. |

**Qué era innecesario y se corrigió:** repetir formularios e historiales en una sola pantalla; mensajes globales incrustados entre controles; tratar un mensaje de error como una lista vacía; mostrar unidades libres como vendibles sin revisar su estado comercial; refrescar Pedidos al deslizar la pantalla de Venta directa. No se agregan nuevas pantallas ni entidades para resolver estos problemas.

**Qué no conviene eliminar:** SKU, lotes, recepción física, mercancía comprometida, clave idempotente y estado pendiente ante respuesta incierta. Simplificar estos controles eliminaría trazabilidad o permitiría vender unidades ajenas/reservadas. El aviso de operación pendiente permanece junto a su acción Verificar/reintentar; es un trabajo sin resolver, no una notificación temporal. Las validaciones de campos permanecen junto al campo correspondiente.

## Defectos corregidos

| Defecto observado | Corrección y alcance |
| --- | --- |
| Avisos nuevos dentro del contenido, distintos de los anteriores. | Web usa `Notificacion` existente; Android comparte `NotificacionEstado` extraído del vendedor. Conservan colores, iconos, animación, cierre y posición. Los errores de un modal se muestran dentro de su capa visible. |
| Un mensaje repetido podía quedar invisible después de cerrar el anterior. | Las notificaciones nuevas identifican cada evento, no solo su texto. Se comprueban dos rechazos consecutivos y varias ediciones consecutivas. |
| Un rechazo de catálogo borraba los campos no controlados. | Se impide el reinicio automático de React después de resolver la acción. Solo el guardado correcto cierra el editor; un error conserva valores y selectores. |
| Una animación anterior podía cerrar otro aviso móvil. | Se detiene al desmontar y el cierre solo se aplica si terminó la animación vigente. |
| Custodia confundía unidades libres con unidades vendibles. | `elegible` exige lote liberado y vigente, familia/producto/SKU activos y datos comerciales habilitados. La cantidad física libre se conserva para permitir su devolución. |
| Etiquetas que confundían validación comercial y condición con disponibilidad. | El catálogo dice Datos confirmados, y la condición de lote dice Liberado. Ninguna de esas etiquetas afirma por sí sola que exista stock vendible. |
| Una respuesta HTTP 200 incompleta podía tratarse como confirmación. | Web y móvil exigen un comprobante válido antes de retirar la solicitud pendiente. Un JSON roto o sin comprobante conserva la misma clave para verificar/reintentar. |
| Sesión vencida y errores de carga poco claros en módulos nuevos. | Se reutiliza el cierre/retorno al acceso, se conserva la operación pendiente y se evita habilitar operaciones o mostrar vacíos falsos después de fallar la consulta. |
| Atrás de Android y actualización podían dejar datos de otra vista. | Atrás utiliza la misma navegación que los botones. Venta directa usa su actualización propia; no refresca pedidos por un gesto ajeno al módulo. |
| Fechas del panel heredado dependían de la zona del servidor. | El formateo fija `America/La_Paz`, como los recorridos operativos. |
| Buscar una presentación por el nombre comercial editado no la encontraba. | La búsqueda incluye el nombre comercial vigente y la descripción de presentación, además del código/nombre histórico. No reescribe el SKU histórico. |

## Coherencia técnica e historial

- Se mantiene `producto` como SKU, con sus IDs y referencias antiguas. Familia y producto comercial son entidades superiores. Los campos históricos del SKU se conservan para compatibilidad; no deben confundirse con otra fuente editable de catálogo. Las consultas del catálogo usan el nombre comercial vigente. Los registros anteriores no se reinterpretan por cambiarlo.
- Precios PostgreSQL decimales y cadenas en el contrato; operaciones conservan precio y datos relevantes del momento. Los datos PROVISIONAL no habilitan ventas. LEGADO mantiene compatibilidad con registros existentes sin convertir su precio en precio oficial confirmado.
- El responsable se obtiene del JWT. La API filtra custodia y operaciones por vendedor y protege catálogo/cargas/recepciones administrativas. Consumidor final se excluye de clientes comerciales, pedidos y rutas.
- Se reutiliza disponibilidad del despacho descontando compromisos. Operaciones concurrentes comparten bloqueos por producto, verifican condición y vigencia dentro de transacción y asignan FEFO. Las guardas de base protegen historial y saldos.
- La ubicación del despacho y el GPS móvil son copias puntuales de la operación. No se inventa la ubicación de la empresa ni se activa seguimiento continuo.
- La API pública proyecta solo catálogo autorizado. Imágenes nuevas se validan y guardan de forma persistente; no dependen del disco temporal de Vercel. No se publican inventario, cuentas ni precios provisionales.
- Esta auditoría no añade tablas ni migraciones. No requiere restaurar ni transformar datos para volver al código anterior de QA.

## Versionado

La ampliación funcional es **1.1.0** respecto de la versión estable **1.0.0**. Mientras permanece en revisión y sin merge se identifica como **1.1.0-rc.1** en web, API, móvil y contrato documental. El prefijo HTTP sigue siendo `/api/v1`; no cambia por una versión de aplicación compatible.

Android usa **versionCode 10102**, superior a las compilaciones QA anteriores. Los APK de revisión etiquetados antes como 1.1.0/1.1.1 se conservan como antecedentes; no se declara que hayan sido versiones estables de `main`. El paquete QA sigue separado del productivo. No se publica una etiqueta de versión estable ni se modifica `main`.

## Verificación y entrega

Las cuatro Actions del código `8240962dcc0ef1b3bad8b5fd192c5e5143e8a1b1` terminaron correctamente:

| Verificación | Evidencia y resultado |
| --- | --- |
| API | [41636741981](https://github.com/RubenMealla/zav-sistema/actions/runs/41636741981): compilación, lint, 26 pruebas unitarias y 65 E2E con PostgreSQL. |
| Web | [41636741840](https://github.com/RubenMealla/zav-sistema/actions/runs/41636741840): compilación y 40 recorridos Playwright; la ejecución local también aprobó los 40. |
| Móvil | [41636741896](https://github.com/RubenMealla/zav-sistema/actions/runs/41636741896): tipos, lint y 20 pruebas. |
| Android | [41636741935](https://github.com/RubenMealla/zav-sistema/actions/runs/41636741935): APK firmada, identidad/versión QA, hora Bolivia con distintas zonas del dispositivo y recorrido real en emulador con API/PostgreSQL locales. |
| Contratos | Ambas especificaciones OpenAPI sin errores de sintaxis; colección Postman local: dos solicitudes y tres aserciones aprobadas. `postman status` no existe en el CLI instalado; esa limitación no se presenta como una comprobación aprobada. |
| Desplegado | Inicio de sesión, avisos repetidos, conservación de campos, modales, catálogo, venta/historial, custodia y landing a 1440/390 px; retorno al acceso al vencer la sesión. Sin errores JavaScript capturados. |

Las regresiones cubren clientes, pedidos, retiros, distribución, entregas, lotes, movimientos, permisos y publicación. La revisión Android comprueba recepción, rechazo de GPS sin salida, venta, notificación flotante, detalle modal, respuesta incierta, reapertura y reintento con la misma solicitud, devolución y conciliación. No se ejecutan esos datos sintéticos contra la base remota que el propietario utiliza.

[APK QA 1.1.0-rc.1, build 10102](https://github.com/RubenMealla/zav-sistema/actions/runs/41636741935/artifacts/13232985740), 149407793 bytes, SHA-256 `907e99ced863f4829a63cbce72200f70e49fd6d34b31f1e6835822bd6b5c6524`. El hash descargado coincide con el archivo de checksum y con el APK efectivamente usado en el emulador. [Resultados/capturas Android](https://github.com/RubenMealla/zav-sistema/actions/runs/41636741935/artifacts/13232837224). GitHub ejecutó el merge de prueba `7cd1959f9270b733044af3a76fa6d6f14c20c9f6`; es la referencia temporal de CI, no una fusión de la rama a `main`.

Los avisos de lint existentes sobre ordenación sin comparador y contadores de revisiones en limpiezas de efectos no son errores de compilación; no se ocultaron para declarar cero avisos.

Commits de esta auditoría: `c87b1ad` (avisos, formularios, elegibilidad y versión), `9f9f4ef` (búsqueda comercial y prueba de versión candidata), `8240962` (etiquetas coherentes y dictamen). Los commits de entrega documental posteriores no cambian esos ejecutables.

Los fallos iniciales se conservan: borrado de campos y segundo aviso invisible detectados por Playwright; expectativas antiguas de versión estable en pruebas web/API que no admitían el sufijo RC. Se corrigieron las causas y las expectativas de versión, sin retirar pruebas.

La comprobación remota encontró nombres modificados durante la revisión del propietario. Al asumir un nombre anterior para probar el rechazo de duplicados, creó una familia vacía en QA. Se identificó como **Ensayo de avisos QA 20261103**, desactivada y oculta, sin borrar historial ni modificar los productos del propietario. Se adaptó la comprobación a los datos actuales; los dos rechazos posteriores, conservación de campos, cierre de avisos, modales, historial y landing a 1440/390 px pasaron en el Preview, sin errores JavaScript. La [evidencia sanitizada](../evidencias/auditoria-coherencia-20261103.json) identifica el registro y los conteos de la base.

## Entornos y recuperación de esta revisión

API QA: `https://zav-api-catalogo-qa.onrender.com`, servicio Render `srv-dbj4ia8u01pc73ef4850`, despliegue `dep-dbkt7lgae00c73c0v1mg`, LIVE, código `9f9f4ef2281c25e693dad9c0a2cc2bce9b3f7d3e`. Salud y versión devolvieron HTTP 200 con `1.1.0-rc.1`. El commit de presentación posterior `8240962` no cambia la API.

Web QA: [Preview de revisión](https://zav-sistema-b0mnx7z8x-dariomealla24-6763.vercel.app), despliegue `dpl_DrHUauCZfrAURdL3Cmg471tWsMGF`, READY, código `8240962dcc0ef1b3bad8b5fd192c5e5143e8a1b1`. El enlace temporal privado se entrega al propietario; no se incluye en Git ni se desactiva la protección global de Vercel.

Base QA: proyecto Neon `fancy-darkness-96751098`, rama `br-dawn-cake-b6cs8va8`, base `zav_catalogo_qa`, once migraciones. Consulta real: cero saldos físicos/custodias/libres negativos, cero SKU sin jerarquía, cero diferencias distribución/custodia y cero custodias sin responsable. Siete familias originales y trece productos con foto original; un Consumidor final, sin pedidos asociados. Las 23 operaciones y 34 movimientos existentes no se borraron ni reinicializaron.

La API productiva `https://zav-api-2026.onrender.com` respondió salud HTTP 200 y versión **1.0.0**. `main` y `origin/main` siguen en el SHA base después de `git fetch origin`. No se ejecutaron migraciones ni pruebas de escritura productivas.

Para volver al código QA previo a esta auditoría:

1. En Render, seleccionar el despliegue anterior `dep-dbk07n7b9u1s73f89g80`, commit `14ce8ff4ecf08e96b2eb1f62caccc8b576178e41`, mediante la función de rollback/redeploy del panel. Verificar `/api/v1/salud`, autenticación y una consulta de conciliación. No cambiar la conexión a la base productiva.
2. Usar el [Preview anterior](https://zav-sistema-dmjhjvojb-dariomealla24-6763.vercel.app), `dpl_DARozZUrhGasVQrRuSVhdGHZkyRA`, código `39cf0a8`. No necesita revertir la base: esta revisión solo cambia consultas, clientes y mensajes; no introduce esquema nuevo.
3. Para Android ya instalado, conservar solicitudes pendientes y confirmar su resultado antes de cambiar de aplicación. Android no permite instalar normalmente un versionCode inferior sobre 10102. Para regresar a la interfaz anterior sin perder almacenamiento local, compilar ese código con la misma identidad/firma QA y un versionCode superior. No indicar desinstalación como reversión inocua: eliminaría datos locales pendientes.
4. Una recuperación de datos es un procedimiento distinto. Esta revisión no necesita restauración de base. La copia productiva restaurada y verificada del 01/11 se conserva en `backups/catalogo-salidas-20261101-verificado/production-previa.dump`, SHA-256 `c12eeb1230f30463dd71bc489a231b012ebc11819ff9ec59efe29e13fae2cbdd`; no se presenta como una copia fresca del 03/11. Para una futura migración productiva hay que refrescar y volver a ensayar el respaldo según el [runbook](../operacion/catalogo-salidas-recuperacion.md).

El retorno de despliegue se documenta con las referencias disponibles; no se ejecutó un rollback de ensayo sobre el entorno que el propietario está utilizando. Los datos añadidos por el propietario no se sobrescriben para cambiar de versión.

## Límites y trabajo que no se declara resuelto

- La revisión del propietario en su teléfono sigue siendo necesaria para confirmar comodidad visual en ese dispositivo. Un emulador no representa todos los teléfonos ni todas las condiciones reales de GPS.
- Los nombres/columnas históricos de SKU se mantienen por compatibilidad. No se intenta borrar esa compatibilidad durante una revisión visual. Las pantallas grandes de operaciones pueden dividirse internamente en componentes más pequeños en mantenimiento posterior, sin añadir pasos al usuario.
- Producción conserva la versión anterior. Los pendientes productivos documentados en el [informe del 31/10](catalogo-salidas-20261031.md), incluido el análisis del cambio externo de SKU y la configuración del despliegue productivo, no se declaran resueltos aquí.
- La decisión de fusionar el PR y publicar la versión estable sigue correspondiendo al propietario. Los resultados de QA no autorizan a presentar una migración productiva no ejecutada como terminada.

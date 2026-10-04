# Verificación de la aplicación móvil del Vendedor · E3

**Fecha:** 3 de octubre de 2026  
**Issue:** #34  
**PR:** #35  
**Rama:** `desarrollo/e3-app-movil-vendedor`

## Alcance verificado en código

La aplicación móvil se limita al rol **VENDEDOR**. Incluye inicio de sesión, almacenamiento seguro de sesión, clientes, disponibilidad, creación de pedido, retiro y confirmación de entrega con captura puntual de ubicación.

La ubicación se solicita únicamente al confirmar una entrega. Si los servicios de ubicación están desactivados o el permiso foreground es denegado, la aplicación no envía la operación de entrega.

Dependencias incorporadas para Expo SDK 57:

- `expo-location ~57.0.20`;
- `expo-secure-store ~57.0.4`.

## Incidencias reales detectadas

### Incidencia M-01 · lint de React Compiler

**Ejecución:** GitHub Actions #37102202214.  
**Resultado:** FALLIDA.

El primer QA móvil detectó dos errores y tres advertencias. Entre ellos:

- restauración de sesión referenciada antes de su declaración;
- actualización síncrona de estado desde un efecto;
- tipos de arreglo no conformes con las reglas de lint.

**Corrección:** se reorganizó la restauración asíncrona de sesión, se separó la carga inicial de la recarga solicitada por el usuario y se normalizaron los tipos.

### Incidencia M-02 · TypeScript y residuos del starter Expo

**Ejecución:** GitHub Actions #37102378630.  
**Resultado:** FALLIDA.

Después de corregir lint, la etapa TypeScript detectó:

- componentes demo del starter Expo que ya no correspondían a la aplicación;
- importaciones CSS del starter;
- un valor `fontWeight: "750"` no válido para React Native.

**Corrección:** se retiraron los componentes, hooks y estilos demo que ya no eran usados y se ajustó el peso tipográfico a un valor admitido.

## Regresión posterior

En el commit `70d39d1`:

- QA mobile #37102610266 → **SUCCESS**: lint y TypeScript correctos.
- QA backend #37102610300 → **SUCCESS**: sin regresiones del backend.
- QA web Playwright #37102610260 → **SUCCESS**: sin regresiones de la web administrativa.

Se añadió además una construcción Android en CI para obtener un APK instalable de revisión. Su resultado debe registrarse antes de declarar la prueba física completada.

## Estado de evidencia

**IMPLEMENTADO EN CÓDIGO + QA ESTÁTICO:** flujo móvil y captura puntual mediante `expo-location`.

**PENDIENTE DE VALIDAR EN DISPOSITIVO:** ejecución real en Android, concesión/denegación del permiso de ubicación, captura GPS del dispositivo y flujo completo contra la API pública.

No se utilizará el QA estático como sustituto de la evidencia física de GPS.

## Decisión cartográfica posterior

Durante el cierre del APK geográfico se comprobó que Google Maps Platform requería habilitar facturación para utilizar Maps SDK for Android. Se reevaluó la dependencia antes de incorporar una credencial de producción.

Se migró el motor móvil a:

- `@maplibre/maplibre-react-native 11.4.1`;
- OpenFreeMap como estilo/cartografía inicial;
- `expo-location` para GPS puntual y fallback de geocodificación;
- Geoapify como proveedor opcional de geocodificación a través de la API ZAV, sin incluir su clave en el APK.

Commits de la migración:

- `0a165e4` — migración del motor de mapa a MapLibre + OpenFreeMap;
- `821f9c8` — lockfile generado por CI y restauración de instalación reproducible con `--frozen-lockfile`;
- `e237917` — geocodificación desacoplada mediante backend y fallback móvil.

**CONFIRMADO:** lint y TypeScript de MapLibre pasaron en GitHub Actions con el lockfile reproducible.

**PENDIENTE DE VALIDAR:** resultado final del primer APK MapLibre firmado y ejecución del mapa en Android físico.


## Primera validación física · hallazgos

**Evidencia proporcionada por el estudiante:** capturas del APK release instalado en Android el 3 de octubre de 2026.

### Hallazgo F-01 · barras del sistema

La cabecera del modal de mapa y su zona inferior podían quedar debajo de la barra de estado o de navegación del dispositivo.

**Corrección en código:** Safe Area reforzada en la raíz y en el modal.  
**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN EL SIGUIENTE APK.

### Hallazgo F-02 · mapa en blanco tras conceder permiso

En el primer uso de búsqueda/ubicación el mapa podía quedar en blanco aunque el permiso de ubicación ya hubiera sido concedido.

**Corrección en código:** el mapa dentro del Modal utiliza TextureView en Android, incorpora estado visible de carga y error, y se recrea al seleccionar una nueva posición.  
**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN DISPOSITIVO.

### Hallazgo F-03 · búsqueda fuera de Tarija

Una consulta textual como “Senac” podía terminar en una localidad extranjera cuando el fallback local del dispositivo resolvía la búsqueda.

**Corrección en código:** el backend centraliza búsqueda/autocompletado y devuelve únicamente coincidencias del departamento de Tarija, Bolivia. También prioriza barrios, zonas y calles frente a edificios cuando existen varias coincidencias.  
**Estado:** IMPLEMENTADO EN CÓDIGO + PRUEBA UNITARIA DEL FILTRO / PENDIENTE DE VALIDAR CON GEOAPIFY REAL.

### Hallazgo F-04 · dirección poco legible

La geocodificación inversa podía mostrar un Plus Code como “F67P+GQ3” como parte principal de la dirección.

**Corrección en código:** se normalizan resultados para priorizar calle, barrio/zona, ciudad y departamento; coordenadas y códigos auxiliares quedan como datos internos.  
**Estado:** IMPLEMENTADO EN CÓDIGO + PRUEBA UNITARIA / PENDIENTE DE REVALIDAR EN DISPOSITIVO.

### Hallazgo F-05 · error al guardar Cliente

El APK geográfico estaba conectado al backend desplegado desde main, que no correspondía al contrato de la rama E3 y rechazaba latitud/longitud como campos no permitidos.

**Corrección de entorno:** se creó el servicio aislado de desarrollo `zav-api-e3-dev`, vinculado a `desarrollo/e3-app-movil-vendedor`. El siguiente APK E3 apunta a ese servicio. Producción no forma parte de esta ronda de validación.

**Estado:** SERVICIO CREADO / PENDIENTE DE COMPLETAR SUS VARIABLES SENSIBLES Y VALIDAR LOGIN + ALTA DE CLIENTE.

### Hallazgo F-06 · pestaña Reparto redundante

La planificación se mostraba como una cuarta pestaña incluso cuando había un único pedido.

**Corrección en código:** Reparto permanece integrado dentro de Pedidos. El bloque siempre es visible y explica cuántos pedidos son planificables; la secuenciación se habilita con dos o más pedidos pendientes georreferenciados.  
**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN DISPOSITIVO.


### Hallazgo F-07 · actualización de Cliente y destino histórico

En development se verificó que pedidos antiguos de un cliente conservaban una dirección previa aunque el registro actual del Cliente ya había sido corregido. Esto corresponde al diseño de instantánea histórica del Pedido, pero la interfaz no lo explicaba con suficiente claridad.

**Corrección en código:** se agregó edición completa de nombre, teléfono y ubicación del Cliente; los pedidos nuevos copian los datos actualizados y los pedidos existentes conservan su destino histórico. Se añadió una prueba E2E específica para este comportamiento.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN ANDROID.

### Hallazgo F-08 · gestión de listas crecientes

La lista completa de Clientes y Pedidos dependía demasiado del desplazamiento vertical.

**Corrección en código:** Clientes incorpora búsqueda y filtro por estado de ubicación; Pedidos incorpora búsqueda por cliente/dirección y filtro por estado; Nuevo pedido permite buscar únicamente clientes con ubicación confirmada.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN ANDROID.


## Tercera validación física · interfaz operativa

**Evidencia reportada por el estudiante:** el flujo geográfico y la organización por cercanía funcionan en Android, pero se detectaron problemas de usabilidad al operar Pedidos.

### Hallazgo F-07 · Pedidos y reparto se percibían como dos módulos

Aunque estaban en la misma pestaña, la interfaz renderizaba un bloque `Reparto` y otro bloque `Pedidos`, obligando a desplazarse entre ambos para cambiar estados.

**Corrección en código:** se eliminó el componente independiente de Reparto. Pedidos concentra filtros, selección, planificación y acciones operativas. Cuando existe una planificación, las paradas ordenadas son las mismas tarjetas de Pedido.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN APK FÍSICO.

### Hallazgo F-08 · mapa interactivo competía con el desplazamiento vertical

El mapa de reparto estaba embebido dentro del ScrollView; los gestos de desplazamiento y zoom podían mover también la pantalla.

**Corrección en código:** el mapa embebido queda como vista previa no interactiva y se abre un mapa de pantalla completa fuera del ScrollView para pan/zoom.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN APK FÍSICO.

### Hallazgo F-09 · navegación externa no abría correctamente

La acción `Abrir navegación` dependía de una URL externa de Google Maps.

**Corrección en código:** la acción operativa se sustituye por `Ver en mapa` dentro del mapa MapLibre de ZAV. No se depende de Google Maps para operar el Pedido.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN APK FÍSICO.

### Hallazgo F-10 · edición de Cliente duplicaba formularios

El formulario de alta permanecía arriba y la edición se desplegaba dentro de la tarjeta seleccionada.

**Corrección en código:** existe un único formulario superior que alterna entre Nuevo cliente y Editar cliente. Al elegir Editar se desplaza al formulario; Cancelar vuelve al modo Nuevo.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN APK FÍSICO.

### Trazabilidad de usuario

**CONFIRMADO EN CÓDIGO Y QA:** cada Pedido registra `vendedor_id` desde el JWT del usuario autenticado; los movimientos RETIRO y ENTREGA registran `usuario_id`. Se añadió una consulta administrativa de solo lectura y prueba E2E para verificar que el Administrador puede identificar al Vendedor responsable y que un VENDEDOR no puede usar la ruta administrativa.


## Cuarta validación física · refinamiento previo al cierre E3

**Evidencia reportada por el estudiante el 4 de octubre de 2026:** el flujo principal de la aplicación móvil funciona correctamente en Android. Antes de fusionar E3 a `main`, se detectaron mejoras de eficiencia y representación cartográfica.

### Hallazgo F-11 · alta consecutiva de Pedidos interrumpida

Después de registrar un Pedido, la app cambiaba automáticamente a Pedidos. Esto obligaba a volver a Nuevo pedido para cada alta consecutiva.

**Corrección en código:** la pantalla permanece en Nuevo pedido, limpia Cliente/cantidades/observación, actualiza disponibilidad y vuelve al inicio del formulario.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN ANDROID.

### Hallazgo F-12 · selección mediante listas extensas

Con decenas de Clientes o productos, la selección mediante tarjetas consecutivas incrementaba el desplazamiento y el tiempo de operación.

**Corrección en código:** se implementaron selectores de pantalla completa, buscables y virtualizados. El formulario conserva únicamente el Cliente y los productos elegidos. El directorio de Clientes muestra inicialmente 8 coincidencias, incorpora búsqueda, filtro de GPS y orden A–Z/Z–A.

**Aclaración:** el Pedido selecciona productos, no lotes físicos. La asignación de lotes continúa en el retiro mediante FEFO.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN ANDROID.

### Hallazgo F-13 · marcadores de Pedidos superpuestos

En una planificación de cinco Pedidos se observó que un número podía quedar oculto por otro marcador. Un Pedido ubicado en el mismo punto que el origen también podía quedar cubierto.

**Corrección en código:** todas las paradas se mantienen en la secuencia y los marcadores reciben una separación visual determinista en píxeles sin modificar sus coordenadas reales. El mapa ofrece además chips con todas las paradas numeradas, de modo que una parada no depende exclusivamente de que su marcador sea visible.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR CON PARADAS COINCIDENTES Y CERCANAS EN ANDROID.

### Hallazgo F-14 · apertura de mapa desde un Pedido

La acción individual podía abrir una vista demasiado general y además esperaba una captura GPS antes de mostrar el mapa.

**Corrección en código:** `Ver destino en mapa` abre inmediatamente el destino enfocado. Si el Pedido pertenece al recorrido activo, abre el recorrido completo pero enfocado en esa parada. El mapa general conserva la vista de todas las paradas.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN ANDROID.

### Hallazgo F-15 · percepción de doble toque

Algunas acciones que esperaban GPS o red no daban suficiente retroalimentación inmediata y podían parecer no ejecutadas.

**Corrección en código:** los botones muestran estados explícitos como “Obteniendo ubicación…” o “Registrando retiro…”, y se bloquean ejecuciones concurrentes de la misma operación para evitar taps duplicados.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN ANDROID.

### Hallazgo F-16 · Pedidos históricos dominaban la vista diaria

Al ingresar a Pedidos se mostraba el historial completo cargado, lo que dificultaba la operación del día.

**Corrección en código:** el periodo inicial es `Hoy · Bolivia`, calculado con `America/La_Paz`, con alternativa `Todo el historial`. Se conservan filtros por estado, búsqueda y carga paginada del historial.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN ANDROID.

### Hallazgo F-17 · retiro repetitivo de varios Pedidos

Con varios Pedidos Registrados, retirar uno por uno añade interacciones innecesarias.

**Corrección en código:** la selección múltiple permite seleccionar Registrados visibles y ejecutar retiro múltiple con la API idempotente existente.

**Decisión:** no se implementó entrega múltiple. Cada entrega requiere su captura GPS puntual y comprobación propia; utilizar una sola posición para varios destinos invalidaría la evidencia geográfica.

**Estado:** IMPLEMENTADO EN CÓDIGO / retiro múltiple ya cubierto por E2E; PENDIENTE DE REVALIDAR LA NUEVA INTERFAZ EN ANDROID.

## Referencia de comparación UX

La revisión técnica que fundamenta estos cambios se documenta en:

`docs/investigacion/revision-ux-movil-pedidos-distribucion-e3.md`

Se utilizaron fuentes oficiales de Route4Me, Onfleet, Shopify POS y MapLibre React Native. La revisión sirve para justificar patrones de interacción; no implica que ZAV replique el alcance funcional de esas plataformas.


## Quinta validación física · refinamiento de selección y recorrido

**Evidencia reportada por el estudiante el 4 de octubre de 2026:** la cuarta versión fue validada en Android y el flujo principal funciona correctamente. Se detectaron tres mejoras antes del cierre de E3.

### Hallazgo F-18 · Safe Area ausente en selectores de Pedido

Los modales de selección de Cliente y productos utilizaban el `SafeAreaView` nativo de React Native, por lo que en el dispositivo físico la cabecera y el pie podían superponerse con la barra de estado y la navegación del sistema.

**Corrección en código:** ambos selectores utilizan `SafeAreaView` de `react-native-safe-area-context` con bordes superior e inferior.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN ANDROID.

### Hallazgo F-19 · nuevos Pedidos no podían incorporarse a un recorrido activo

Una planificación existente debía cancelarse y generarse de nuevo para incluir Pedidos registrados durante la distribución.

**Corrección en código:** mientras existe un recorrido activo, la app detecta Pedidos con GPS que todavía no pertenecen a la planificación. La acción **Añadir** captura la ubicación actual del Vendedor, combina las paradas existentes con los nuevos Pedidos y solicita una nueva secuencia sin cancelar previamente el recorrido.

Las paradas existentes se preservan aunque no estén visibles en la página actual del historial.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR CON ALTA DE PEDIDO DURANTE RECORRIDO.

### Hallazgo F-20 · selección duplicada y exceso de controles

Las acciones “Seleccionar pendientes” y “Seleccionar registrados” podían mostrar cantidades iguales y obligaban al Vendedor a interpretar una diferencia de estados que no era necesaria para la operación cotidiana.

**Corrección en código:** se sustituyeron por una única acción **Seleccionar visibles**. Las acciones posteriores se habilitan según los estados reales de lo seleccionado:
- organizar si hay dos o más Pedidos georreferenciados;
- retirar únicamente los seleccionados que siguen en REGISTRADO;
- la entrega continúa individual por GPS puntual.

La tarjeta de recorrido activo también se compactó y agrupa en una misma fila Actualizar ubicación / Finalizar organización.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN ANDROID.


## Sexta validación física · cierre de operación y trazabilidad

**Evidencia reportada por el estudiante el 4 de octubre de 2026:** la quinta versión fue validada físicamente y el flujo principal funciona correctamente. Se solicitaron los últimos cambios antes de cerrar la rama E3.

### Hallazgo F-21 · Pedidos entregados saturaban la operación activa

**Corrección en código:** la pantalla principal de Pedidos consulta únicamente `REGISTRADO` y `EN_DISTRIBUCION`. Un botón **Historial** abre una interfaz de pantalla completa con Safe Area, búsqueda y filtros propios para `ENTREGADO` y `CANCELADO`.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN EL APK DEL HEAD FINAL.

### Hallazgo F-22 · estados operativos poco diferenciados

**Corrección en código:** las tarjetas `REGISTRADO` se identifican como **Pendiente de retiro** con acento ámbar; las `EN_DISTRIBUCION` como **Listo para confirmar entrega** con acento verde. La acción de entrega utiliza además una jerarquía visual distinta.

**Estado:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE REVALIDAR EN ANDROID.

### Hallazgo F-23 · alertas persistentes e inconsistentes

**Corrección en código:** mensajes informativos y errores operativos utilizan avisos flotantes temporales que se retiran automáticamente; los diálogos modales se reservan para decisiones que requieren confirmación explícita, por ejemplo retirar, entregar, dar de baja o anular.

**Estado:** IMPLEMENTADO EN CÓDIGO / QA móvil superó lint y TypeScript en una ejecución previa; PENDIENTE DE QA FINAL DEL HEAD Y VALIDACIÓN FÍSICA.

### Hallazgo F-24 · alta/baja de Cliente

**Decisión:** se adopta una única **baja lógica** mediante el campo `activo` existente. El Cliente no se borra físicamente, permanece en el directorio bajo el filtro **De baja**, no puede utilizarse en Pedidos nuevos y puede reactivarse.

**Estado:** IMPLEMENTADO EN API, móvil y pruebas E2E / PENDIENTE DE QA FINAL DEL HEAD.

### Hallazgo F-25 · Pedido registrado incorrectamente

**Decisión:** no se aplica borrado lógico genérico al Pedido. Se permite **Editar** o **Anular** únicamente mientras el estado sea `REGISTRADO`. La anulación cambia el estado a `CANCELADO`, conserva fecha/motivo y libera el compromiso de stock. Un Pedido retirado o entregado queda protegido contra estas operaciones.

**Estado:** IMPLEMENTADO EN API, móvil, migración y E2E / PENDIENTE DE QA FINAL DEL HEAD.

### Incidencias reales detectadas durante QA

1. Se detectó y corrigió un parámetro SQL incompleto en el filtro de Pedidos por estado.
2. La primera ejecución E2E de esta ronda reveló que la base aislada no incluía aún la nueva migración de cancelación; el setup se actualizó para ejecutar la misma migración antes de las pruebas.

Estas incidencias se conservan como evidencia real y no se presentan como resultados exitosos.


## Novena validación física · aceptación de ZAV Vendedor 1.0.0

**Evidencia reportada por el estudiante el 4 de octubre de 2026:** la compilación final fue probada en un dispositivo Android y, para el alcance de esta primera versión, la aplicación se considera estable y funcional.

### Resultado físico final

- **CONFIRMADO:** inicio de sesión y navegación principal funcionan.
- **CONFIRMADO:** Pedidos y Nuevo pedido funcionan después de la corrección del filtro SQL por estado.
- **CONFIRMADO:** Clientes lista, permite edición y permite Desactivar/Reactivar.
- **CONFIRMADO:** los productos sin stock no se muestran en el selector de productos para registrar un Pedido.
- **CONFIRMADO:** las notificaciones, botones, filtros y compactación visual resultan utilizables en el dispositivo probado.
- **CONFIRMADO:** los selectores respetan Safe Area superior e inferior.
- **CONFIRMADO:** el icono de la aplicación y el nombre **ZAV Vendedor** se visualizan correctamente.
- **CONFIRMADO:** los símbolos semitransparentes observados inicialmente no aparecen en capturas de pantalla de la aplicación y el estudiante verificó que corresponden al dispositivo, no a ZAV Vendedor.

### Identidad de la versión aceptada

- Nombre: **ZAV Vendedor**
- Versión funcional inicial: **1.0.0**
- Android versionCode: **10000**
- iOS buildNumber: **10000**
- Package/bundle: `bo.zav.gestion.vendedor`
- Slug/esquema: `zav-vendedor`

### Criterio de cierre E3

La versión 1.0.0 se acepta como primera versión funcional del módulo móvil del Vendedor. Esta aceptación no significa que el software sea definitivo ni que no pueda recibir mejoras futuras; significa que el alcance comprometido para E3 fue implementado, sometido a QA automatizada y validado físicamente por el estudiante.

**Estado:** VALIDADO FÍSICAMENTE / LISTO PARA FUSIÓN A `main`.

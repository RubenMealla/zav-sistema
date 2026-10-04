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

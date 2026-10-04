# ZAV 2026 — Rediseño de geolocalización y distribución

**Estado general:** IMPLEMENTADO EN CÓDIGO / PENDIENTE DE VALIDACIÓN FÍSICA FINAL.  
**Ámbito:** aplicación móvil del Vendedor y API REST.  
**Objetivo:** ampliar el uso de geolocalización para que apoye el registro del punto de entrega, la preparación del reparto y la verificación de entrega sin convertir el sistema en rastreo GPS continuo ni en optimización automática de rutas.

## 1. Problema técnico que se corrige

La implementación actual de RF-11 captura latitud y longitud únicamente al confirmar una entrega. Ese comportamiento acredita una captura GPS puntual, pero no integra la ubicación con el proceso completo de Cliente → Pedido → Retiro → Reparto → Entrega.

El rediseño propone que la geolocalización intervenga en tres decisiones operativas concretas:

1. georreferenciar el punto habitual de entrega del Cliente;
2. sugerir una secuencia de reparto cuando existen varios pedidos;
3. comparar la ubicación real de entrega con el destino esperado.

No se implementará seguimiento continuo del Vendedor.

## 2. Decisión de diseño

### 2.1 Mapa dentro de la aplicación

**Decisión implementada en código:** MapLibre React Native 11.4.1 como motor cartográfico y OpenFreeMap como fuente inicial del estilo/tiles vectoriales.

La elección separa deliberadamente el **motor de representación** del **proveedor de cartografía**. El estilo se configura mediante `EXPO_PUBLIC_MAP_STYLE_URL` y actualmente apunta a `https://tiles.openfreemap.org/styles/liberty`. Por ello, cambiar de proveedor compatible con MapLibre no exige reescribir el flujo Cliente → Pedido → Reparto.

**Alternativas consideradas:**

- Google Maps SDK: descartado como motor principal porque exige habilitar facturación en Google Cloud aun cuando el uso concreto pueda resultar sin cargo; además introduce dependencia de una credencial y plataforma propietaria;
- Mapbox: técnicamente completo, pero con mayor dependencia del proveedor;
- servicios públicos directos de OpenStreetMap: descartados como infraestructura principal porque no constituyen un servicio de hosting con SLA para aplicaciones;
- MapLibre + OpenFreeMap: elegido por compatibilidad nativa, licencia abierta, ausencia de API key para el mapa base y posibilidad de migrar a otro proveedor o autoalojar cartografía en una evolución futura.

**Limitación aceptada:** el servicio público de OpenFreeMap no ofrece un SLA contractual. Para una operación empresarial crítica o de mayor escala se deberá evaluar un proveedor con SLA o cartografía autoalojada. Esta limitación no se oculta ni se interpreta como disponibilidad garantizada.

### 2.2 Ubicación puntual y geocodificación

Se conserva `expo-location` para:

- solicitar permiso foreground;
- obtener la ubicación actual cuando el usuario la pide;
- disponer de un fallback de geocodificación en el dispositivo;
- realizar captura GPS puntual al confirmar una entrega.

No se solicita permiso de ubicación en segundo plano.

Para mejorar la búsqueda de direcciones sin exponer una credencial en el APK se incorpora una capa de geocodificación en la API ZAV. El backend puede utilizar **Geoapify** mediante `GEOAPIFY_API_KEY`, restringiendo los resultados de búsqueda al departamento de Tarija, Bolivia. La app consulta:

- `GET /api/v1/geografia/geocodificar?q=...`;
- `GET /api/v1/geografia/reversa?latitud=...&longitud=...`.

La clave de Geoapify permanece únicamente en el servidor. Si el proveedor no está configurado o temporalmente no está disponible, el cliente conserva un fallback con `expo-location`. La ausencia de Geoapify no bloquea la compilación del APK ni la selección manual del punto en el mapa.

### 2.3 Navegación

El sistema delega la navegación giro a giro a una aplicación/servicio externo de mapas mediante un enlace al destino confirmado. ZAV no implementa un motor propio de navegación y el mapa embebido no se presenta como navegación vial.

### 2.5 Alcance geográfico de búsqueda

**Decisión implementada:** la búsqueda, el autocompletado y la validación inversa se restringen al **departamento de Tarija, Bolivia**. La expansión a otros departamentos queda fuera del alcance actual y podrá habilitarse posteriormente sin cambiar el motor MapLibre.

La interfaz solicita sugerencias a partir de dos caracteres y muestra hasta ocho coincidencias relevantes de calles, barrios, zonas, localidades o referencias. No se afirma que la fuente posea un catálogo exhaustivo de todos los barrios y calles del país: la cobertura depende de los datos disponibles en OpenStreetMap/Geoapify.

Para evitar confusión del usuario final, las coordenadas y códigos geográficos auxiliares permanecen como datos técnicos internos. La dirección visible prioriza calle, barrio/zona, ciudad y departamento cuando esos datos están disponibles.

### 2.6 Compatibilidad física Android

Durante la primera validación en un teléfono Android se observó solapamiento del modal con las barras del sistema y un mapa en blanco después de conceder permiso de ubicación. Se aplicaron dos correcciones:

- SafeAreaProvider + SafeAreaView en el modal y contenedores principales;
- androidView="texture" en MapLibre dentro del Modal, utilizando TextureView para evitar problemas de composición con la superficie nativa del mapa.

Estas correcciones permanecen **PENDIENTES DE REVALIDAR EN DISPOSITIVO FÍSICO** hasta instalar el siguiente APK.

### 2.4 Secuenciación de entregas

Se implementa una **secuenciación geográfica sugerida por proximidad**, no una “ruta óptima”.

El cálculo utilizará distancia geodésica entre coordenadas (fórmula Haversine) y una heurística de vecino más cercano:

1. elegir un origen;
2. seleccionar el destino pendiente más cercano;
3. convertir ese destino en el nuevo punto de referencia;
4. repetir hasta ordenar todos los pedidos seleccionados.

El Vendedor podrá modificar manualmente el orden sugerido.

**Limitación declarada:** no considera tráfico, sentido de circulación, horarios comerciales ni restricciones viales. Por ello no se presentará como optimización de rutas, TSP o VRP.

## 3. Flujo RF-07 — Cliente georreferenciado

### 3.1 Registro

El Vendedor completa nombre, teléfono opcional y dirección textual.

La ubicación geográfica **no se guarda automáticamente**.

La acción **Definir ubicación en mapa** abre un selector con tres posibilidades:

- **Usar mi ubicación:** obtiene una posición puntual del dispositivo;
- **Buscar dirección:** geocodifica el texto introducido y centra el mapa;
- **Seleccionar en mapa:** el Vendedor mueve el mapa o toca un punto para colocar/corregir el marcador.

Antes de persistir, la pantalla muestra:

- dirección textual;
- coordenadas candidatas;
- mapa;
- acción **Confirmar ubicación**.

Solo después de esa confirmación se guardan las coordenadas.

### 3.2 Casos reales cubiertos

**Caso A — Vendedor en el local del Cliente:** utiliza “Mi ubicación” y confirma/corrige el punto.

**Caso B — Cliente registrado por llamada o mensaje:** busca la dirección o selecciona manualmente el punto sin necesidad de estar físicamente allí.

**Caso C — Geocodificación imprecisa:** mueve el marcador antes de confirmar.

### 3.1 Ubicación obligatoria y edición del Cliente

Para el alcance actual, un Cliente nuevo no puede registrarse sin un punto de entrega confirmado. La interfaz principal no permite escribir libremente la dirección: el texto visible se obtiene del selector geográfico y se almacena junto con latitud y longitud.

El Vendedor puede editar nombre, teléfono y ubicación. Un cambio en el Cliente se aplica a **pedidos nuevos**; los pedidos ya registrados conservan la instantánea histórica de dirección y coordenadas con la que fueron creados.

La sección Clientes incorpora búsqueda y filtros por disponibilidad de ubicación para evitar depender de desplazamiento vertical cuando crezca el número de registros.

## 4. Punto geográfico de despacho

La ubicación de inventario `VENTA_DESPACHO` representa el origen físico de los productos. Se agregaron coordenadas geográficas a esa ubicación y su configuración está disponible desde la web administrativa. Las coordenadas reales de ZAV permanecen PENDIENTES DE VALIDAR y no se inventan.

No se crea una novena entidad.

La georreferencia de despacho debe diferenciarse de `EN_DISTRIBUCION`, que es una custodia lógica y no un punto físico fijo.

## 5. Snapshot geográfico del Pedido

Al crear un Pedido se copiarán desde el Cliente:

- `direccionEntrega`;
- `destinoLatitud`;
- `destinoLongitud`.

El Pedido conserva esa instantánea aunque posteriormente cambie la dirección habitual del Cliente.

Esto evita modificar implícitamente el historial de entregas anteriores.

## 6. RF-10 — Retiro para reparto

El texto de interfaz se cambia de **Retirar** a **Retirar para reparto**.

Semánticamente significa:

> El Vendedor recibió físicamente los productos y asume su custodia para distribuirlos.

Transición:

`REGISTRADO → EN_DISTRIBUCION`

Movimiento:

`VENTA_DESPACHO → EN_DISTRIBUCION`

Se conserva:

- asignación FEFO;
- idempotencia;
- comprobación de stock;
- movimiento transaccional.

### 6.1 Retiro múltiple

IMPLEMENTADO EN CÓDIGO: permite seleccionar varios pedidos `REGISTRADO` y ejecutar **Retirar seleccionados para reparto**.

La API procesa cada Pedido con su propia transacción e idempotencia y devuelve un resultado individual. Se incorporó prueba E2E para retiro múltiple y repetición de las mismas claves.

## 7. Planificar reparto

Función implementada para pedidos propios en estado `REGISTRADO` o `EN_DISTRIBUCION`.

### 7.1 Selección

El Vendedor selecciona dos o más pedidos con destino georreferenciado.

### 7.2 Origen

Puede elegir:

- **Venta y Despacho ZAV**; o
- **Mi ubicación actual**.

La segunda opción solicita una captura puntual foreground.

### 7.3 Resultado

La aplicación muestra:

- mapa con origen y destinos numerados;
- orden sugerido;
- distancia geodésica aproximada entre paradas;
- distancia total aproximada;
- controles para mover una parada arriba/abajo.

El orden sugerido no modifica el estado de los Pedidos.

### 7.4 Integración con la sección Pedidos

El planificador de reparto dejó de presentarse como una pestaña independiente y se integra en **Pedidos**. El bloque permanece visible para explicar el estado del reparto; la secuenciación se habilita cuando existen al menos dos pedidos pendientes con destino georreferenciado. Los pedidos históricos sin GPS se identifican explícitamente y los entregados no participan en una nueva salida.

### 7.5 Operación unificada de Pedidos

La aplicación móvil no presenta Reparto como un módulo independiente. La sección **Pedidos** integra selección, secuenciación geográfica, retiro, consulta en mapa y confirmación de entrega.

Cuando existe una secuencia activa:
- las paradas son las mismas tarjetas operativas de Pedido;
- una entrega confirmada se retira del plan activo;
- la ubicación puntual capturada en esa entrega pasa a ser el nuevo origen de referencia;
- el Vendedor puede actualizar su ubicación y solicitar nuevamente el orden sugerido de las paradas restantes;
- el mapa manipulable se abre en pantalla completa para evitar conflicto de gestos con el desplazamiento vertical.

La vista previa cartográfica no representa navegación vial giro a giro.

### 7.6 Trazabilidad por Vendedor

Todo Pedido conserva el `vendedor_id` obtenido de la sesión JWT. Las acciones que generan movimientos de inventario registran además `usuario_id`. Esta asociación es obligatoria y permite auditar quién registró y ejecutó las operaciones.

El Administrador dispone de una consulta de solo lectura de Pedidos con Vendedor responsable. La futura Venta Directa deberá conservar la misma regla de trazabilidad.

## 8. RF-11 — Entrega con comprobación geográfica

Para un Pedido `EN_DISTRIBUCION`, la pantalla muestra:

- destino confirmado;
- mapa;
- acción **Abrir navegación**;
- acción **Confirmar entrega**.

Al confirmar:

1. la app solicita/valida permiso foreground;
2. obtiene una nueva posición puntual;
3. guarda precisión reportada por el dispositivo;
4. calcula distancia entre destino esperado y posición real;
5. muestra el resultado antes del envío definitivo;
6. el usuario confirma la entrega.

### 8.1 Entrega alejada del destino

El sistema no bloqueará automáticamente una entrega por distancia, porque ZAV no ha proporcionado todavía una regla empresarial de tolerancia.

**PENDIENTE DE VALIDAR:** radio de advertencia.

Cuando exista un radio configurado y la posición esté fuera de él:

- mostrar advertencia;
- exigir una observación/motivo;
- conservar destino esperado, posición real, distancia y motivo.

No se inventará un valor de 50/100/200 m sin validación.

## 9. Cambios propuestos al modelo de datos

Las ocho entidades principales se conservan.

### Cliente

Agregar, nullable hasta completar migración:

- `latitud` numeric(9,6);
- `longitud` numeric(9,6);
- `ubicacion_confirmada_en` timestamptz.

### Ubicacion

Para ubicaciones físicas:

- `latitud` numeric(9,6);
- `longitud` numeric(9,6).

Regla: solo `AREA_FISICA` puede utilizar coordenadas geográficas fijas. `CUSTODIA_LOGICA` no requiere un punto fijo.

### Pedido

Agregar:

- `destino_latitud` numeric(9,6);
- `destino_longitud` numeric(9,6);
- `entrega_precision_m` numeric nullable;
- `entrega_distancia_destino_m` numeric nullable;
- `entrega_observacion` varchar nullable.

Se conservan `entrega_latitud` y `entrega_longitud` como posición real de confirmación.

No se crea una entidad “Ruta”.

## 10. Contrato API implementado en la rama E3

### Cliente

`POST /api/v1/clientes`

Extender entrada con:

- `latitud?`;
- `longitud?`.

Regla: ambos o ninguno.

IMPLEMENTADO:

`PATCH /api/v1/clientes/:id/ubicacion`

Permite corregir dirección/coordenadas sin alterar Pedidos históricos.

### Despacho

IMPLEMENTADO:

`GET /api/v1/ubicaciones/venta-despacho` — Vendedor lectura.

`PATCH /api/v1/ubicaciones/:id/georreferencia` — Administrador.

### Pedido

`POST /api/v1/pedidos` copiará las coordenadas confirmadas del Cliente al Pedido.

IMPLEMENTADO:

`POST /api/v1/pedidos/planificacion`

Entrada:

- `pedidoIds[]`;
- `origenTipo: DESPACHO | ACTUAL`;
- `origenLatitud?`;
- `origenLongitud?`.

Respuesta calculada, sin persistir una entidad Ruta:

- pedidos ordenados;
- distancia desde origen;
- distancia desde parada anterior;
- distancia total aproximada.

### Entrega

Extender `POST /api/v1/pedidos/:id/entrega`:

- `operacionClave`;
- `latitud`;
- `longitud`;
- `precisionMetros?`;
- `observacionDistancia?`.

El servidor vuelve a calcular la distancia contra el destino del Pedido. No confiará en una distancia calculada únicamente por el cliente móvil.

## 11. Criterios de aceptación propuestos

### RF-07

**Camino feliz:** dado un Vendedor autenticado, cuando registra un Cliente y confirma un punto en el mapa, entonces el Cliente queda con dirección y coordenadas confirmadas.

**Error/alternativa:** dado que el Vendedor no está físicamente en el Cliente, cuando busca una dirección o mueve el mapa, entonces puede confirmar el punto sin utilizar su ubicación actual.

### RF-10

**Camino feliz:** dado un Pedido REGISTRADO con stock comprometido, cuando el Vendedor confirma “Retirar para reparto”, entonces el Pedido pasa a EN_DISTRIBUCION y se generan movimientos FEFO desde VENTA_DESPACHO.

**Error:** dado un Pedido fuera de REGISTRADO o sin cobertura física, cuando intenta retirar, entonces la API responde 409 sin duplicar movimientos.

### RF-11

**Camino feliz:** dado un Pedido EN_DISTRIBUCION con destino georreferenciado, cuando el Vendedor obtiene una posición puntual y confirma la entrega, entonces se registra ubicación real, precisión, distancia respecto al destino y el Pedido pasa a ENTREGADO.

**Error:** dado que el permiso de ubicación fue rechazado, cuando intenta confirmar la entrega, entonces la app no inventa coordenadas ni cambia el Pedido a ENTREGADO.

### Planificación geográfica

**Camino feliz:** dados varios pedidos georreferenciados y un origen, cuando se solicita planificación, entonces la API devuelve una secuencia reproducible por proximidad y distancias aproximadas.

**Limitación:** el resultado no se etiqueta como ruta óptima y puede ser reordenado por el Vendedor.

## 12. Trazabilidad

| Necesidad | Requisito | Diseño | Prueba futura |
|---|---|---|---|
| Registrar destino real del cliente | RF-07 | mapa + búsqueda + confirmación | registro por ubicación actual y por dirección remota |
| Custodiar producto al salir | RF-10 | Retirar para reparto + FEFO | transición, idempotencia, stock |
| Organizar varios pedidos | extensión de distribución | vecino más cercano + Haversine | secuencia determinista y reordenable |
| Llegar al destino | apoyo operativo RF-11 | navegación externa | enlace generado con destino correcto |
| Acreditar entrega | RF-11 | posición real + precisión + distancia | GPS válido, permiso denegado, distancia calculada |

## 13. Decisiones de defensa

**Qué se elige:** georreferenciación puntual y asistencia geográfica de distribución.

**Para qué:** conectar Cliente, Pedido, inventario y entrega mediante información espacial útil.

**Alternativas consideradas:**

- GPS solo al entregar: insuficiente como apoyo operativo;
- seguimiento continuo: descartado por alcance, privacidad y complejidad;
- Google Maps/Places/Routes como núcleo: descartado por dependencia de plataforma, credenciales y requisito de facturación;
- optimización TSP/VRP: descartada porque el problema real no incluye suficientes restricciones para afirmar una ruta óptima.

**Limitación aceptada:** las distancias utilizadas para ordenar pedidos son geodésicas y no equivalen a distancia vial ni tiempo de conducción.

## 14. Estado de veracidad

- Captura GPS puntual al entregar: **IMPLEMENTADO EN CÓDIGO Y API; PENDIENTE DE REVALIDACIÓN FÍSICA DEL APK GEOGRÁFICO**.
- Registro de Cliente y Pedido: **IMPLEMENTADO**.
- Mapa interactivo para Cliente: **IMPLEMENTADO EN CÓDIGO CON MAPLIBRE + OPENFREEMAP; PENDIENTE DE VALIDAR FÍSICAMENTE EN ANDROID**.
- Coordenadas de Cliente/Despacho: **IMPLEMENTADO EN MODELO Y API; coordenadas reales de ZAV PENDIENTES DE VALIDAR**.
- Snapshot geográfico del Pedido: **IMPLEMENTADO**.
- Secuenciación por proximidad: **IMPLEMENTADO Y CUBIERTO POR E2E**.
- Reordenamiento manual de la secuencia: **IMPLEMENTADO EN MÓVIL**.
- Retiro múltiple para reparto: **IMPLEMENTADO EN CÓDIGO Y CUBIERTO POR E2E; pendiente de QA del HEAD**.
- Navegación externa: **IMPLEMENTADO EN CÓDIGO; PENDIENTE DE VALIDACIÓN FÍSICA**.
- Precisión/distancia de entrega: **IMPLEMENTADO Y CUBIERTO POR E2E**.
- Radio de advertencia: **PENDIENTE DE VALIDAR**.

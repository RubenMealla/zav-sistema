# ZAV 2026 — Rediseño de geolocalización y distribución

**Estado general:** PROPUESTO / PENDIENTE DE IMPLEMENTAR.  
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

Para Android se propone **Expo Maps** sobre Expo SDK 57. La documentación oficial permite mostrar Google Maps, marcadores, polilíneas, responder a movimientos de cámara y clics en el mapa.

**Alternativa evaluada:** `react-native-maps`.

**Elección propuesta:** Expo Maps, porque el cliente móvil ya utiliza Expo SDK 57 y la integración oficial reduce dependencias adicionales. La configuración real de Google Maps para el APK standalone deberá verificarse con una clave del Maps SDK for Android antes de declarar el mapa IMPLEMENTADO.

### 2.2 Ubicación puntual

Se conserva `expo-location` para:

- solicitar permiso foreground;
- obtener la ubicación actual cuando el usuario la pide;
- geocodificar una dirección escrita;
- realizar geocodificación inversa de un punto seleccionado.

No se solicitará permiso de ubicación en segundo plano.

### 2.3 Navegación

El sistema podrá abrir Google Maps para navegar hacia el destino confirmado del Pedido. La navegación giro a giro queda delegada a la aplicación de mapas; ZAV no implementará un motor propio de navegación.

### 2.4 Secuenciación de entregas

Se propone una **secuenciación geográfica sugerida por proximidad**, no una “ruta óptima”.

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

## 4. Punto geográfico de despacho

La ubicación de inventario `VENTA_DESPACHO` representa el origen físico de los productos. Se propone agregar coordenadas geográficas a esa ubicación y configurarlas desde la web administrativa.

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

PROPUESTO: permitir seleccionar varios pedidos `REGISTRADO` y ejecutar **Retirar seleccionados para reparto**.

La operación debe ser transaccional por pedido y devolver el resultado individual. No se declarará implementada hasta tener pruebas E2E.

## 7. Planificar reparto

Nueva función propuesta para pedidos propios en estado `REGISTRADO` o `EN_DISTRIBUCION`.

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

## 10. Contrato API propuesto

### Cliente

`POST /api/v1/clientes`

Extender entrada con:

- `latitud?`;
- `longitud?`.

Regla: ambos o ninguno.

PROPUESTO posteriormente:

`PATCH /api/v1/clientes/:id/ubicacion`

Permite corregir dirección/coordenadas sin alterar Pedidos históricos.

### Despacho

PROPUESTO:

`GET /api/v1/ubicaciones/venta-despacho` — Vendedor lectura.

`PATCH /api/v1/ubicaciones/:id/georreferencia` — Administrador.

### Pedido

`POST /api/v1/pedidos` copiará las coordenadas confirmadas del Cliente al Pedido.

PROPUESTO:

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
| Llegar al destino | apoyo operativo RF-11 | abrir Google Maps | enlace generado con destino correcto |
| Acreditar entrega | RF-11 | posición real + precisión + distancia | GPS válido, permiso denegado, distancia calculada |

## 13. Decisiones de defensa

**Qué se elige:** georreferenciación puntual y asistencia geográfica de distribución.

**Para qué:** conectar Cliente, Pedido, inventario y entrega mediante información espacial útil.

**Alternativas consideradas:**

- GPS solo al entregar: insuficiente como apoyo operativo;
- seguimiento continuo: descartado por alcance, privacidad y complejidad;
- Google Places/Routes como núcleo: no seleccionado inicialmente por dependencia externa, credenciales y posible costo;
- optimización TSP/VRP: descartada porque el problema real no incluye suficientes restricciones para afirmar una ruta óptima.

**Limitación aceptada:** las distancias utilizadas para ordenar pedidos son geodésicas y no equivalen a distancia vial ni tiempo de conducción.

## 14. Estado de veracidad

- Captura GPS puntual al entregar: **IMPLEMENTADO y probado en código/API; pendiente de revalidar tras este rediseño**.
- Registro de Cliente y Pedido: **IMPLEMENTADO**.
- Mapa interactivo para Cliente: **PROPUESTO**.
- Coordenadas de Cliente/Despacho: **PROPUESTO**.
- Snapshot geográfico del Pedido: **PROPUESTO**.
- Secuenciación por proximidad: **PROPUESTO**.
- Navegación externa: **PROPUESTO**.
- Precisión/distancia de entrega: **PROPUESTO**.
- Radio de advertencia: **PENDIENTE DE VALIDAR**.

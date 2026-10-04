# Revisión comparativa de UX móvil para Pedidos y Distribución — E3

**Fecha de revisión:** 4 de octubre de 2026  
**Alcance:** apoyo técnico para refinar la aplicación móvil del Vendedor antes de cerrar E3.  
**Estado:** decisiones IMPLEMENTADAS EN CÓDIGO; revalidación física del APK todavía PENDIENTE.

## 1. Objetivo

Revisar patrones de interacción utilizados por productos actuales de reparto y punto de venta para resolver problemas observados durante la prueba física de ZAV:

- listas crecientes de Clientes y productos;
- repetición de altas de Pedidos;
- selección de varios Pedidos para preparar una salida;
- consulta combinada de lista y mapa;
- enfoque de una parada concreta;
- solapamiento visual de marcadores;
- retroalimentación insuficiente durante operaciones que usan GPS o red.

Esta revisión es una comparación técnica de interfaz, no una afirmación de equivalencia funcional entre ZAV y las plataformas consultadas.

## 2. Fuentes técnicas consultadas

### Route4Me

Documentación oficial:

- https://support.route4me.com/start-and-complete-routes/
- https://support.route4me.com/start-navigate-routes-driver-mobile-app/

Patrones observados:

- listado de rutas por fecha;
- búsqueda;
- lista de destinos y mapa dentro del mismo flujo;
- apertura de una parada concreta desde la lista;
- continuidad entre inicio, navegación, estado y prueba de entrega.

### Onfleet

Documentación oficial:

- https://support.onfleet.com/hc/en-us/articles/360023670292-App-Task-View
- https://support.onfleet.com/hc/en-us/articles/360023910111-Task-Assignment
- https://support.onfleet.com/hc/en-us/articles/47768817655956-Route-Load-Task

Patrones observados:

- tareas visibles tanto en lista como en mapa;
- selección de varias tareas;
- preparación/carga de varios elementos antes de comenzar entregas;
- orden operativo explícito.

### Shopify POS

Documentación oficial:

- https://help.shopify.com/es/manual/sell-in-person/shopify-pos/inventory-management/searching-for-products

Patrones observados:

- búsqueda antes que recorrido manual de catálogos extensos;
- coincidencias por varios atributos del producto;
- incorporación rápida de un producto a la operación actual.

### MapLibre React Native

Documentación oficial:

- https://maplibre.org/maplibre-react-native/docs/components/annotations/marker/
- https://maplibre.org/maplibre-react-native/docs/components/camera/

Capacidades utilizadas:

- desplazamiento visual de un marcador mediante `offset`;
- cámara inicial por centro/zoom para una parada;
- cámara por `bounds` para visualizar un conjunto de paradas;
- interacción con marcadores.

## 3. Decisiones adoptadas para ZAV

### 3.1 Alta consecutiva de Pedidos

Después de registrar un Pedido la app:

1. permanece en **Nuevo pedido**;
2. limpia Cliente, cantidades y observación;
3. consulta nuevamente disponibilidad;
4. deja el formulario listo para el siguiente Pedido.

**Justificación:** evita navegación repetitiva cuando el Vendedor registra varios Pedidos en una misma sesión.

### 3.2 Selector buscable de Cliente

El formulario principal ya no muestra todos los Clientes uno debajo de otro. Abre un selector de pantalla completa con búsqueda por:

- nombre;
- teléfono;
- dirección.

Solo se ofrecen Clientes con ubicación confirmada para Pedidos nuevos.

### 3.3 Selector buscable de productos

El formulario muestra únicamente los productos ya agregados al Pedido. La selección completa se realiza en un buscador por:

- nombre;
- código;
- familia;
- presentación.

Las cantidades pueden ajustarse sin recorrer todo el catálogo.

**Aclaración de alcance:** el Vendedor selecciona **productos**, no el lote físico concreto. El backend asigna lotes al momento del retiro siguiendo disponibilidad y vencimiento. No se introdujo selección manual de lote porque rompería la asignación FEFO ya implementada sin existir un requisito que la justifique.

### 3.4 Pedidos del día como vista inicial

La pestaña Pedidos inicia en **Hoy**, calculado explícitamente con la zona `America/La_Paz`. El Vendedor puede cambiar a **Todo el historial**.

Los filtros por estado siguen disponibles de forma independiente.

### 3.5 Selección múltiple y retiro

Se puede seleccionar varios Pedidos, incluidos todos los Registrados visibles, y ejecutar retiro múltiple.

**Decisión de seguridad/trazabilidad:** no se implementa “Entregar todos”. Cada entrega conserva una comprobación GPS puntual propia; una única posición no puede utilizarse como evidencia de múltiples destinos.

### 3.6 Mapa general y mapa enfocado

- desde el recorrido se abre el conjunto completo;
- desde una tarjeta de Pedido se abre el mapa enfocado en ese destino;
- el mapa incorpora accesos a cada parada numerada;
- al enfocar una parada se utiliza centro y zoom específicos;
- al mostrar la ruta completa se utiliza el conjunto de coordenadas como límites.

### 3.7 Marcadores coincidentes o muy próximos

Los marcadores conservan su coordenada real como dato, pero reciben un pequeño `offset` visual determinista en píxeles. Esto evita que dos Pedidos con el mismo punto oculten completamente sus números.

El origen utiliza un marcador oscuro, las paradas el color principal de ZAV y la parada enfocada un verde sobrio. No se emplea una paleta multicolor por parada para evitar ruido visual.

**Limitación:** el desplazamiento es únicamente de representación. La línea y las coordenadas almacenadas permanecen sin modificación.

### 3.8 Retroalimentación de acciones

Las acciones que requieren GPS o red muestran inmediatamente estado ocupado, por ejemplo:

- “Obteniendo ubicación…”;
- “Registrando retiro…”;
- “Registrando y actualizando stock…”.

También se bloquean repeticiones concurrentes de la misma acción para reducir dobles ejecuciones por taps repetidos.

## 4. Alternativas descartadas en esta ronda

- **Lista completa permanente de Clientes/productos:** descartada por escalabilidad de interacción.
- **Entrega masiva:** descartada por incompatibilidad con la evidencia GPS puntual por Pedido.
- **Clustering que oculta el número de cada parada como solución única:** no se adopta en esta etapa porque el Vendedor necesita reconocer el orden de cada parada; se prioriza separación visual + lista/chips de paradas.
- **Navegación externa obligatoria:** no se utiliza como operación principal; el mapa interno cubre visualización y enfoque. La navegación vial giro a giro permanece fuera del alcance actual.
- **Optimización vial/VRP:** sigue fuera de alcance. La secuencia actual es una sugerencia geográfica, no una ruta óptima.

## 5. Limitaciones y validación pendiente

- La secuencia usa distancias geodésicas; no representa tiempo de conducción ni calles.
- El offset de marcadores debe revalidarse con varios Pedidos exactamente coincidentes y cercanos en Android.
- La rapidez percibida de botones y selectores requiere nueva prueba física.
- La vista “Hoy” se ha diseñado para la operación diaria; el historial completo se carga por páginas para no depender de un único bloque grande.
- Ninguna de estas correcciones se considera validada físicamente hasta instalar y probar el APK generado desde el HEAD correspondiente.

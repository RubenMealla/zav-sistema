# Rediseño de experiencia web administrativa — ZAV 2026

**Issue:** #23  
**Rama:** `desarrollo/redisenio-ui-web`  
**Estado:** CONFIRMADO EN RAMA mediante lint, build, QA backend, Playwright y revisión visual.

## Problema que resolví

La primera interfaz permitía ejecutar las funciones de inventario, pero concentraba Productos, Lotes, Condiciones y Movimientos en una sola página vertical. Para cambiar de tarea debía desplazarme por la página y, después de algunas operaciones, podía perder el contexto de trabajo.

El rediseño no cambia las reglas de negocio. Cambia la forma de acceder a ellas.

## Decisión de diseño

Organicé la web como una aplicación administrativa por módulos:

```
Resumen general
├── Productos terminados
├── Lotes y existencias
├── Condición de lotes
└── Movimientos
```

En escritorio utilizo una barra lateral fija. En pantallas pequeñas utilizo navegación horizontal desplazable.

Cada operación se mantiene en su módulo. Por ejemplo, después de registrar un traslado vuelvo a la vista Movimientos y conservo el lote consultado.

## Inicio público

Rediseñé la página de inicio para:

- diferenciar claramente la parte pública del sistema interno;
- comunicar el propósito real de la plataforma;
- mostrar una representación conceptual del panel sin inventar datos operativos;
- mantener un único acceso privado al sistema.

No muestro métricas empresariales ficticias en la portada.

## Acceso administrativo

Rediseñé el login con:

- separación visual entre identidad del sistema y formulario;
- explicación breve de seguridad y trazabilidad;
- mensajes de error claros;
- campo de contraseña con mostrar/ocultar;
- diseño responsive;
- conservación de la sesión HTTP-only y de las reglas JWT existentes.

## Panel administrativo

El panel ahora dispone de:

- dashboard/resumen;
- indicadores obtenidos de datos reales cargados por la API;
- accesos rápidos a cada módulo;
- navegación persistente;
- títulos y descripciones por módulo;
- estados visuales para `RETENIDO`, `LIBERADO` y `BLOQUEADO`;
- vista de existencias por ubicación;
- línea de tiempo para la auditoría de condición;
- historial de movimientos separado de la gestión de lotes.

## Modales

Los formularios que representan operaciones se abren en ventanas modales:

- registrar producto;
- registrar lote e ingreso inicial;
- registrar traslado;
- liberar o bloquear un lote.

Esto evita ocupar permanentemente el espacio de consulta y mantiene al usuario dentro del módulo actual.

No agregué una librería externa de componentes. Implementé los modales mediante el elemento HTML `dialog`, React y CSS del proyecto.

## Notificaciones

Los mensajes posteriores a una operación se muestran como notificaciones tipo toast:

- éxito;
- error.

La notificación aparece sobre la interfaz, puede cerrarse manualmente y desaparece automáticamente después de unos segundos.

Las acciones de servidor continúan utilizando redirecciones y parámetros de estado, por lo que no se altera el contrato con la API.

## Diseño visual

Conservé una identidad visual basada en verde oscuro, blanco y grises neutros para mantener relación con ZAV sin convertir la interfaz en un sitio decorativo.

Priorizo:

- contraste;
- jerarquía;
- densidad moderada de información;
- tablas legibles;
- estados reconocibles;
- espacio suficiente entre operaciones;
- consistencia entre inicio, acceso y panel.

## Responsive

En escritorio:
- sidebar fija;
- topbar;
- tablas y módulos amplios.

En dispositivos más pequeños:
- la sidebar se sustituye por navegación horizontal;
- métricas y tarjetas cambian a menos columnas;
- modales y formularios pasan a una columna;
- el acceso se simplifica.

## Tecnología

No incorporé dependencias nuevas para el rediseño.

Se mantiene:

- Next.js 16.3.5;
- React 19.2.8;
- TypeScript;
- CSS/Tailwind ya configurado;
- Server Actions;
- Playwright 1.63.0.

También incorporé un conjunto pequeño de iconos SVG propios dentro del código para evitar una dependencia adicional solamente por iconografía.

## Limitaciones actuales

Este rediseño corresponde a las funciones implementadas hasta inventario.

Las vistas futuras de clientes, pedidos, distribución y catálogo público deberán respetar el mismo sistema de navegación y componentes, pero no se consideran implementadas en esta iteración.


## Consolidación visual posterior — Issue #39

La rama `mejora/ui-web-consolidada` continúa el trabajo de interfaz sobre el `main` actual sin sustituir la evidencia del rediseño original.

### Landing pública extendida

La portada contempla cuatro bloques públicos:

1. Catálogo / Productos.
2. Promociones.
3. Noticias / Información.
4. Nosotros / Identidad ZAV.

Las tres primeras secciones se controlan mediante:

```env
ZAV_LANDING_EXTENDIDA=true
```

La configuración permite revisar y desarrollar la experiencia pública sin afirmar que Catálogo, Promociones o Noticias están implementados cuando aún no existe su contenido o administración definitiva.

En producción la variable debe permanecer ausente o en `false` hasta que el alcance funcional correspondiente esté validado. Para QA y preview de la rama de consolidación se habilita en `true`.

### Dirección visual

La consolidación evita patrones repetitivos de tarjetas e iconos genéricos. Se adoptan composiciones editoriales asimétricas, jerarquía tipográfica y ritmos distintos para Catálogo, Promociones, Noticias y Nosotros.

Las referencias visuales externas sirven únicamente para estudiar patrones de composición; no se copian imágenes, textos, identidad ni layouts distintivos de terceros.

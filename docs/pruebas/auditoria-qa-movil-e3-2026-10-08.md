# Auditoría de evidencias Android — E3 (8 de octubre de 2026)

## Alcance y procedencia
Este registro distingue los resultados reproducibles de GitHub Actions de los casos aún no ejecutados por la interfaz. Rama de trabajo: `pruebas/evidencias-qa-reales`. Sin datos reales de clientes ni coordenadas de entregas reales: se usa PostgreSQL aislado de QA.

## Ejecuciones revisadas
| Ejecución | Resultado observado | Alcance verificable |
| --- | --- | --- |
| [APK #305](https://github.com/RubenMealla/zav-sistema/actions/runs/37646347475) | Compilación correcta; automatización visual fallida | El error `No se abrió Clientes` era una aserción incompatible con la pantalla real; se conservaron capturas diagnósticas |
| [Evidencias móviles #100](https://github.com/RubenMealla/zav-sistema/actions/runs/37723600658) | Workflow correcto | Artefacto `evidencias-movil-qa-100`, con capturas MOV-01 a MOV-16; reporte global de capturas MOV-01 a MOV-12 y reportes independientes de registro y retiro |
| [APK #311](https://github.com/RubenMealla/zav-sistema/actions/runs/37723604453) | Ambos jobs correctos | APK QA construido y verificado, emulador y capturas MOV-01 a MOV-12 en artefacto `evidencias-movil-verificables-311` |
| [APK #315](https://github.com/RubenMealla/zav-sistema/actions/runs/37728215017) | Ambos jobs correctos | Confirmó nuevamente compilación, instalación y capturas del APK existente en emulador Android |
| [Móvil #101](https://github.com/RubenMealla/zav-sistema/actions/runs/37727544548) y [#102](https://github.com/RubenMealla/zav-sistema/actions/runs/37728211245) | Casos previos correctos y nueva validación fallida | Un tap al botón `Guardar cliente` se desviaba al teclado Android todavía visible; se conservaron captura diagnóstica y reporte FALLIDO |
| [Móvil #103](https://github.com/RubenMealla/zav-sistema/actions/runs/37730923473) | Workflow correcto | `evidencias-movil-qa-103`: 17 capturas MOV-01 a MOV-17; cliente sin ubicación rechaza guardado, sin inserción (0 antes y 0 después), junto a los casos previos positivos |
| [Móvil #104](https://github.com/RubenMealla/zav-sistema/actions/runs/37731586673) | En comprobación al momento de actualizar este registro | Añadido caso de anulación desde Android y separación de resultados por caso; no declarar resultado hasta inspeccionar el artefacto |

## Análisis de causa y corrección aplicada

Las ejecuciones #101–102 no demostraron un defecto en el registro de clientes: el botón aparecía en la jerarquía accesible, pero el teclado virtual ocupaba su posición de pantalla. La automatización insertó un carácter adicional en el campo Nombre en vez de ejecutar Guardar. El commit `031fbdf2` comprueba la integridad del nombre escrito, cierra el teclado y confirma la pestaña antes de activar Guardar. El reporte de #103 confirmó la validación negativa y la no persistencia de datos.

El workflow de evidencias reutiliza el APK QA firmado de #305 (SHA de origen `2336ddad...`), comprobando su integridad. El flujo APK se ajustó para compilar automáticamente solo ante cambios que afectan el código integrado en el APK, sin reconstruirlo por editar scripts de QA. El objetivo es mantener separadas evidencia de compilación y evidencia funcional.

## Evidencia de interfaz y ejecución
- MOV-01–03: pantalla de acceso, validación local y respuesta 401 visible.
- MOV-04–08: pantalla de pedidos, formulario, selectores de clientes/productos y validación del formulario.
- MOV-09–11: pantalla Clientes, validación y selector de ubicación/mapa.
- MOV-12: retorno a Pedidos.
- MOV-13–14 (workflow #100): formulario completo y registro desde Android. El reporte independiente indica que el número de pedidos pasó de 1 a 2 en la base aislada.
- MOV-15–16 (workflows #100/#103): diálogo de confirmación y retiro desde Android. El reporte independiente indica que los pedidos `EN_DISTRIBUCION` pasaron de 1 a 2.
- MOV-17 (workflow #103): cliente con nombre pero sin ubicación confirmada es rechazado; el reporte independiente indica 0 coincidencias antes y después en la API QA.
- La ejecución #311 captura únicamente MOV-01 a MOV-12; no se debe declarar que esta segunda suite confirma registro o retiro.

## Alcance todavía no demostrado en la interfaz de Android
La suite aún no aporta evidencias automatizadas completas del registro positivo de un cliente desde Android, edición y cancelación de pedido, retiro múltiple, organización/reorganización del recorrido, GPS puntual y confirmación efectiva de entrega, ni de sus correspondientes caminos de error. La preparación de datos por API no equivale a realizar estos flujos desde la interfaz.

## Próximos casos y requisitos de aceptación
1. Cliente: crear desde formulario móvil y comprobar persistencia en la API aislada; probar campo obligatorio inválido y ubicación no confirmada.
2. Pedido: edición/cancelación permitida y rechazo cuando el estado no lo permita; verificar ausencia de efectos parciales.
3. Retiro: flujo múltiple y rechazo por estado/saldo; comprobar variación de inventario y movimiento correspondiente.
4. Reparto: generar secuencia desde Android, observar mapa y modificar/incluir pedidos; validar restricciones con datos sintéticos.
5. Entrega: inyectar GPS sintético identificado como tal en emulador, confirmar entrega mediante UI y verificar estado, fecha y coordenadas en API; probar permiso denegado y distancia/estado inválidos.
6. Para cada caso: captura Android original, resultado esperado, obtenido, código HTTP cuando aplique, comprobación de persistencia y referencia a run/artifact/commit. Mantener reportes individuales aunque falle otro caso.

## Controles del proceso
- No reutilizar imágenes generadas o reconstruidas como capturas de ejecución.
- No marcar como aprobada una prueba solo porque el APK compila o el emulador arranca.
- Evitar recompilar la aplicación cuando cambien exclusivamente los scripts de captura; el APK reutilizado debe identificarse por SHA y variables de entorno.
- Mantener separados QA con API local aislada y validación de APK de producción: una prueba local no acredita por sí sola la URL pública.
- No borrar ramas, commits, artefactos ni antecedentes de fallos.

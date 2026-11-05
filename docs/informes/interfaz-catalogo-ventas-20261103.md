# Reorganización de catálogo, ventas y mercancía

Entrega de revisión del 03/11/2026. Rama `desarrollo/ventas-directas-catalogo`, base `e9dc1a40476a72034f38e4dabb0e178c62af0066`. El [PR 74](https://github.com/RubenMealla/zav-sistema/pull/74) permanece abierto y sin fusionar.

## Cambios para el usuario

- Venta directa web separa Nueva venta de Historial. Ver detalle abre una ventana con los productos, lotes y responsable.
- Mercancía en distribución separa Nueva carga, Mercancía por vendedor, Devoluciones e Historial.
- Catálogo conserva Familias, Productos y Presentaciones como vistas independientes. Crear y Editar abren ventanas; los botones se alinean con los filtros y las filas incluyen miniaturas. El cambio desde Ver productos muestra carga en lugar de la tabla anterior.
- Android separa Nueva venta, Mi mercancía, Recibir cargas, Devolver sobrantes e Historial. Se corrigió Ver detalle: antes agregaba contenido al final de la pantalla; ahora abre un comprobante visible con botón Cerrar. Los estados, cantidades y acciones recuperan los colores de ZAV y se sustituyen UUID por nombres en la interfaz.
- Menú web más compacto. Ilustración propia en el acceso y en Nosotros, sin repetir el logo grande. Las familias usan dibujos SVG; las fotografías reales de productos se conservan. Las imágenes estáticas usan tamaños adaptativos de Next Image y carga diferida donde corresponde. No se afirma una reducción porcentual de tiempo sin medirla.
- Las listas consultan solo los datos de su vista y descartan respuestas atrasadas. Se conservaron las validaciones, permisos, GPS puntual, reservas de pedidos e idempotencia. Este cambio no agrega migraciones ni modifica la API o los datos productivos.

## Versiones entregadas

- `39cf0a8cfbb1e41bbe8423e564d7463562ab5aba`: reorganización de interfaces y pruebas asociadas.
- `60e3ea806b3050f2ad700a5f45071cdc37a4ab9e`: actualización de la prueba de versión Android a 1.1.1 / 10101.
- [Web desplegada](https://zav-sistema-dmjhjvojb-dariomealla24-6763.vercel.app): Vercel `dpl_DARozZUrhGasVQrRuSVhdGHZkyRA`, READY, código web de `39cf0a8` idéntico al de `60e3ea8`. El acceso temporal privado se entrega al propietario, sin publicarlo en Git.
- [APK QA 1.1.1, build 10101](https://github.com/RubenMealla/zav-sistema/actions/runs/41536504894/artifacts/13185885740). Paquete `bo.zav.gestion.vendedor.qa`, API QA remota. SHA-256 `4fa4267c6534c66983c51603572f00ae3df7d2539e7b367dc187ad3e6fe32c0c`, 149406685 bytes, cotejado contra el archivo de checksum de la compilación.
- Render QA conserva `https://zav-api-catalogo-qa.onrender.com`, servicio `srv-dbj4ia8u01pc73ef4850`. Neon QA conserva `zav_catalogo_qa`, rama `br-dawn-cake-b6cs8va8`. Las comprobaciones de la interfaz desplegada no crearon ni alteraron operaciones.

## Comprobaciones reales

| Comprobación | Resultado |
| --- | --- |
| [API](https://github.com/RubenMealla/zav-sistema/actions/runs/41536504837) | Compilación, lint, 26 pruebas unitarias y 63 E2E con PostgreSQL aprobados. |
| [Web](https://github.com/RubenMealla/zav-sistema/actions/runs/41536504838) | Compilación y 39 pruebas Playwright aprobadas; además, 13 pruebas enfocadas en las pantallas modificadas pasaron localmente. |
| [Móvil](https://github.com/RubenMealla/zav-sistema/actions/runs/41536504912) | Tipos, lint y pruebas aprobados. |
| [Android](https://github.com/RubenMealla/zav-sistema/actions/runs/41536504894) | APK firmada, hora boliviana y recorrido de ventas en emulador aprobados. Recepción, rechazo de permiso GPS, venta, detalle modal, respuesta perdida, reapertura/reintento sin duplicar y devolución conciliada con PostgreSQL. |
| Web desplegada | Inicio de sesión real, catálogo, modal y Escape, familia → productos, nueva venta → historial → detalle, mercancía y devoluciones; landing a 1440 y 390 px con imágenes cargadas y sin desbordamiento horizontal. Sin errores JavaScript capturados. |

La prueba de versión móvil falló inicialmente al conservar la expectativa 1.1.0; se corrigió a la versión efectiva y la ejecución posterior aprobó. La primera comprobación remota de Nosotros usó un selector inexistente (`#nosotros`); se corrigió el script de comprobación al identificador real `#zav`, sin alterar el producto para acomodar la prueba.

[Evidencia Android descargable](https://github.com/RubenMealla/zav-sistema/actions/runs/41536504894/artifacts/13186921151), incluyendo captura del comprobante. Las capturas y el resultado de la verificación remota se conservaron localmente en `backups/ui-desplegada-20261102/`; las operaciones de ensayo Android se ejecutaron en `zav_test` aislado.

## Uso y alcance

La [guía funcional](../operacion/catalogo-salidas-guia.md) refleja los nuevos botones y recorridos. Instalar la nueva APK QA sobre la anterior y usar las mismas cuentas de revisión. El enlace temporal de la web no desactiva su protección general.

Producción y `main` permanecen sin modificar. No se generó una nueva APK productiva para esta revisión visual. La validación Android fue en emulador; queda la revisión del propietario en su teléfono. Los pendientes productivos de la ampliación original siguen documentados en el [informe anterior](catalogo-salidas-20261031.md); esta entrega no los declara resueltos.

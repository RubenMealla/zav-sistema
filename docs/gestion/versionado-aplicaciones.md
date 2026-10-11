# Versionado de las aplicaciones ZAV

## Versiones iniciales estables

| Componente | Versión funcional | Fuente de verdad | Identificación visible |
|---|---|---|---|
| ZAV Web (página pública, acceso y administración) | **1.0.0** | `apps/web/package.json` | Pie de la página pública, pantalla de acceso y panel |
| ZAV Vendedor para Android | **1.0.0** | `apps/mobile/package.json` y `apps/mobile/app.json` | Información de aplicación/instalable Android |
| APK Android 1.0.0 | Código de compilación **10000** | `apps/mobile/app.json` (`android.versionCode`) | Propiedades del paquete Android |
| API de NestJS | Versión independiente del cliente web | Archivos y contrato de la API | Rutas `/api/v1/...` que identifican la versión del contrato, no la versión de la web |

La versión `0.1.0` del paquete privado en la raíz del monorepositorio no es una versión pública del sistema. No debe confundirse con las versiones de las aplicaciones.

## Convención de numeración

Se usa **versionado semántico** `MAYOR.MENOR.PARCHE`:

- **MAYOR:** cambios incompatibles con funcionalidades o contratos anteriores.
- **MENOR:** nuevas capacidades compatibles con el comportamiento anterior.
- **PARCHE:** correcciones compatibles que no alteran los contratos o funciones existentes.

Las aplicaciones **web y móvil mantienen ciclos independientes**: una modificación exclusiva de la interfaz web no altera automáticamente la versión de Android, y viceversa. La API tiene su propio ciclo de despliegue y un contrato público con prefijo `/api/v1`.

## Publicación de una actualización web

1. Crear una rama desde `main` y registrar el alcance del cambio en GitHub y Trello.
2. Actualizar `version` **solo en `apps/web/package.json`**. El archivo `apps/web/app/lib/version.ts` importa dicho valor para presentar la misma versión en los tres lugares.
3. Registrar brevemente los cambios funcionales y la compatibilidad. Evitar utilizar la fecha, número de despliegue o identificador de cambio como sustituto del número de versión.
4. Ejecutar pruebas, lint y compilación de la web; si corresponde, comprobar también integración con API y base de pruebas.
5. Integrar a `main` mediante una solicitud de integración sin eliminar la rama ni sus commits. Confirmar publicación en Vercel, y si no hubo cambios de backend ni migraciones, no forzar actualizaciones innecesarias a Render o Neon.
6. Comprobar que página pública, acceso y panel presentan la misma versión y que la interfaz funciona en escritorio y móvil.

**Observación:** los despliegues pueden suceder sin cambio de versión si solo afectan infraestructura o documentación, pero cada publicación funcional destinada al usuario debe registrar su versión de manera coherente.

## Publicación de una actualización móvil

1. Modificar coordinadamente `apps/mobile/package.json` y `apps/mobile/app.json` (`expo.version`).
2. Para un nuevo APK distribuible, aumentar `android.versionCode` de forma **estrictamente creciente**, incluso cuando se recompila una versión con el mismo identificador funcional. Para iOS, aumentar el `buildNumber` según las reglas de publicación.
3. Generar y verificar el nuevo APK y registrar la ejecución real de compilación. No afirmar que un APK se instaló en un dispositivo sin comprobación.
4. Conservar historial, informes y artefactos. Un archivo temporal de GitHub Actions no equivale a un canal de descarga permanente.

## Estado de la primera versión estable

- **Web 1.0.0:** declara su versión en su paquete, muestra el mismo valor en página pública, acceso y panel; las pruebas automatizadas verifican estas superficies y su adaptación a dos anchos.
- **Android 1.0.0 (compilación 10000):** conserva el identificador ya utilizado en el APK de referencia. La web no altera dicho instalable.
- **Base de datos:** no requiere cambios de esquema ni migraciones para mostrar el número de versión web.

La existencia de una versión estable designa el alcance funcional declarado; no garantiza disponibilidad continua ni desempeño bajo todas las cargas. Estos aspectos requieren verificaciones independientes y reproducibles.

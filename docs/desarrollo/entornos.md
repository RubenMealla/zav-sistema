# Entornos y archivos privados

Cada aplicación tiene su propia configuración. Un archivo global con todos los secretos dificultaría separar el servidor de los clientes públicos.

| Aplicación | Archivo local activo | Contenido |
|---|---|---|
| API | `apps/api/.env` | PostgreSQL local, JWT privado, puerto y CORS |
| Web | `apps/web/.env.local` | URL de la API para el servidor Next.js |
| Móvil | `apps/mobile/.env`, si se necesita | URLs públicas de API y mapas |

Los tres `.env.example` son plantillas versionadas, no entornos adicionales. No contienen secretos reales. Las variables `EXPO_PUBLIC_*` se incorporan al APK: nunca guardar contraseñas, tokens privados ni conexiones PostgreSQL en ellas. La web utiliza `API_BASE_URL` del lado del servidor.

## Configuración y respaldo

Las configuraciones auxiliares de QA, ensayo y respaldo se archivaron fuera del repositorio, con copias verificadas. No forman parte del arranque habitual ni están versionadas. Los archivos locales de herramientas también permanecen fuera del árbol de trabajo.

La configuración diaria debe apuntar a una base local de desarrollo, separada de `zav_test`. Crear esa base y aplicar las migraciones antes del primer arranque. Comprobar siempre el destino efectivo de `DATABASE_URL`: las variables del proceso tienen prioridad sobre los archivos.

Render y Vercel reciben sus valores mediante la configuración del servicio. En GitHub Actions las contraseñas de usuarios sintéticos y el JWT se generan por ejecución y se enmascaran. La contraseña del contenedor PostgreSQL de CI es desechable y no guarda relación con Neon.

## Controles del repositorio

- `pnpm security:files` rechaza `.env` reales, claves privadas, respaldos y directorios generados incluidos en Git.
- El workflow **07 · Seguridad — Archivos y credenciales** ejecuta Gitleaks sobre el historial alcanzable y redacta los valores del informe.
- `.gitleaksignore` contiene siete huellas históricas revisadas: JWT sintéticos de pruebas locales y un nombre de migración interpretado como clave. No excluye archivos completos ni permite nuevas credenciales con el mismo patrón.
- `knip.json` identifica scripts operativos y sustituciones de Metro. Los módulos nativos `@expo/ui`, `expo-glass-effect`, `expo-symbols` y fuentes se conservan para Expo Router y el enlace nativo. `expo-updates` es una referencia inferida por el analizador, no una dependencia utilizada por la aplicación.

Un escaneo sin hallazgos no demuestra ausencia absoluta de secretos. Si se confirma una filtración, revocar o rotar la credencial afectada y revisar accesos; borrar un archivo del último commit no elimina su historial. Nunca copiar credenciales a informes, Issues o capturas.

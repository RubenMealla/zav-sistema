# Pruebas manuales antes de integrar una mejora

**Estado:** plan de comprobación; no se atribuyen resultados hasta ejecutar cada escenario. Probar únicamente la rama Git de trabajo y la rama Neon `development-pc-20261011`. **No utilizar `production`.**

## Preparar la segunda PC

1. En Visual Studio Code, detener los servidores anteriores con `Ctrl+C`.
2. En la raíz `C:\Users\RENE\Documents\proyectos\zav-sistema`:
   ```powershell
   git status -sb
   git fetch origin
   git switch --track origin/mejora/calidad-arquitectura
   ```
   Si la rama ya existe localmente, ejecutar `git switch mejora/calidad-arquitectura` y `git pull --ff-only`. Antes de cambiar de rama, guardar o apartar cualquier cambio local no confirmado.
3. Confirmar la rama con `git branch --show-current` y `git status -sb`. Verificar que los `.env` locales no se hayan reemplazado.
4. `apps/api/.env`: `NODE_ENV=development`, `DATABASE_URL` de Neon **development**, JWT local, Geoapify si corresponde y `CORS_ORIGINS=http://localhost:3000`.
5. `apps/web/.env.local`: `API_BASE_URL=http://localhost:3001`.
6. En terminales diferentes, arrancar:
   ```powershell
   pnpm --filter @zav/api start:dev
   pnpm --filter @zav/web dev
   ```
7. Verificar `http://localhost:3001/api/v1/salud` y `http://localhost:3000/acceso`.

**No compartir cadenas de conexión, tokens ni contraseñas en Issues, capturas o mensajes.** La rama Development se originó mediante una copia de datos; usar registros de prueba identificados y conservar la posibilidad de restaurar antes de pruebas destructivas.

## Lista de comprobación — Web y API

- [ ] Autenticación: acceso con Administrador autorizado, credenciales inválidas y cierre de sesión.
- [ ] Autorización: una cuenta Vendedor no accede al panel Administrador.
- [ ] Productos: visualizar, buscar, paginar, registrar y actualizar un producto **de prueba**; comprobar código duplicado y campos vacíos.
- [ ] Lotes: consultar estado, validar fechas y operaciones de condición con datos preparados.
- [ ] Movimientos: comprobar rechazo por saldo insuficiente y confirmaciones antes de modificar inventario de prueba.
- [ ] Pedidos: filtros, páginas y orden; cambio entre Pedidos y Distribución sin errores.
- [ ] Distribución: comprobar carga del mapa, búsqueda de direcciones y edición de ubicación **solo con datos de prueba**, si corresponde.
- [ ] Interfaz: modales, notificaciones de éxito y error, mensajes HTTP, estados de espera, teclado y accesibilidad básica.
- [ ] Diseño adaptable: inspeccionar tamaños de pantalla de escritorio y móvil en las herramientas del navegador.
- [ ] Comprensión del código: modificar temporalmente una etiqueta o un color CSS en local, observar resultado y revertir.

## Lista de comprobación — Android (cuando se retome)

- [ ] Asegurar URL de API de pruebas antes de compilar; `10.0.2.2` solo funciona dentro del emulador Android estándar.
- [ ] Inicio de sesión de Vendedor, permisos y gestión de sesión.
- [ ] Directorio de clientes, selección de cliente y productos, registro/edición de pedido.
- [ ] Retiro, actualización de planificación, cancelación, entrega y errores por stock o ubicación.
- [ ] GPS puntual, permisos, mapa y comportamiento sin conexión.
- [ ] APK QA firmado, instalado y ejecutado en dispositivo/emulador compatible.

## Evidencias y criterio de aceptación

Guardar capturas de errores y éxitos **reales**, indicando fecha, rama, commit, rol y escenario. Los checks de GitHub Actions cubren parte del código, pero **no sustituyen** la revisión manual. No marcar una tarea como validada sin una ejecución observada. Antes de integrar a `main`, revisar el PR, validar funcionalidades afectadas y evitar crear datos reales de operación en el entorno de pruebas.

## Probar el APK QA en un teléfono físico

1. En PowerShell de la PC, usar `ipconfig` y localizar la dirección IPv4 de la conexión Wi-Fi (por ejemplo `192.168.1.20`). La IP puede cambiar. El celular y la PC deben usar la misma red local.
2. Mantener NestJS activo con la conexión de Neon `development-pc-20261011` y `NODE_ENV=development`. Nunca usar `production`.
3. Abrir en el navegador del celular `http://IP_DE_PC:3001/api/v1/salud`. Debe devolver `{"estado":"ok"}`. Si falla, revisar red y firewall de Windows antes de iniciar sesión.
4. Descargar el artefacto más reciente `ZAV-Vendedor-1.0.0-build10000-qa-run-N` desde la verificación **04 · Android — Compilación APK** del PR #71, descomprimir e instalar el APK en Android (habilitar instalación de origen autorizado si el sistema lo solicita).
5. Comprobar que el icono se llame **ZAV Vendedor QA**; esta variante tiene identificador distinto al instalador estable.
6. Abrir **Configurar API de mi computadora** en la pantalla de acceso, escribir `http://IP_DE_PC:3001` y pulsar **Probar y guardar servidor**.
7. Iniciar sesión con una cuenta Vendedor del entorno Development y realizar las comprobaciones móviles del apartado anterior. Evitar contraseñas y datos reales cuando se utiliza HTTP en una red local de pruebas.

La compilación QA admite HTTP solamente por su configuración nativa de pruebas; la compilación release conserva la política de red original. El servidor local puede cambiar de IP sin regenerar el APK. Esta configuración no afecta a Neon Production ni a la app estable.

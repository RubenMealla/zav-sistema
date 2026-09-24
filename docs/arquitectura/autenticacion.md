# Autenticacion interna de ZAV (primera version)

## Alcance

- Inicio de sesion para usuarios internos mediante identificador y contrasena.
- Hash de contrasenas Argon2id. Token JWT HS256 con 15 minutos de vigencia.
- `GET /api/v1/auth/me` requiere un JWT; verifica en PostgreSQL que la cuenta sigue activa.
- Guards reutilizables `JwtAuthGuard`, `RolesGuard` y decorador `@Roles('ADMINISTRADOR')` para las futuras rutas de productos y lotes.
- No hay registro publico de empleados. El Administrador inicial se provisiona mediante un script local, una sola vez y solo sobre la rama development mientras se hacen pruebas. Ejecutar `scripts/crear-admin.mjs --crear-en-development` despues de verificar que la cadena privada es de esa rama.

## Endpoints

`POST /api/v1/auth/login`: cuerpo JSON `{ "identificador": "...", "contrasena": "..." }`. Devuelve `accessToken`, `tokenType`, `expiresIn` (segundos) y `usuario` sin hash. `400` si la entrada es invalida; `401` si la cuenta no existe, no esta activa o la clave es incorrecta.

`GET /api/v1/auth/me`: cabecera `Authorization: Bearer <token>`; devuelve id, identificador, nombre y rol de la cuenta activa. Sin token o con token invalido devuelve `401`.

## Seguridad y limites

- Generar `JWT_SECRET` aleatorio (48 bytes recomendados) en cada entorno. No enviar a la aplicacion web o movil, no guardar en Git ni en Trello.
- El JWT no contiene el rol; en cada peticion protegida se consulta el usuario activo y el rol vigente en PostgreSQL. El guard de roles se aplicara a cada operacion administrativa cuando se implemente.
- No guardar tokens de acceso en `localStorage` del navegador. La futura interfaz web debera usar una sesion de servidor/cookie HttpOnly y la app movil almacenamiento seguro.
- No se ha implementado revocacion inmediata de tokens, renovacion de sesion, recuperacion de contrasena ni limitacion de intentos de acceso. Estas medidas se deben completar y probar antes de un despliegue real con usuarios operativos.
- La prueba del login no es evidencia de que productos o lotes tengan permisos protegidos: esas rutas todavia no se han incorporado.

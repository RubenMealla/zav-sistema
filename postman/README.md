# Contratos y comprobaciones locales

Contrato de referencia: `docs/api/openapi-e3.yaml`. Se generó una colección con Postman CLI 1.82.0 y se conserva fuera de Git en `backups/postman-generada-openapi-20261028`. La colección pequeña versionada conserva las comprobaciones ejecutables de publicación y separación de inventario, sin cientos de ejemplos genéricos que requieren datos por escenario.

Por seguridad, el destino predeterminado y la guarda admiten únicamente `http://127.0.0.1:3001` o `http://localhost:3001`. Las solicitudes versionadas son de solo lectura y no necesitan JWT. Las operaciones encadenadas y la concurrencia se comprueban con la suite E2E HTTP/PostgreSQL.

Con la API local y `zav_test` preparada:

```sh
postman spec lint docs/api/openapi-e3.yaml --issueType syntax --no-report-events
postman spec lint apps/web/public/openapi-zav.yaml --issueType syntax --no-report-events
postman collection lint "postman/collections/ZAV verificacion local"
postman collection run "postman/collections/ZAV verificacion local" --no-report-events
```

La comprobación de Postman complementa las E2E HTTP/PostgreSQL y Playwright; no reemplaza concurrencia ni flujos de inventario. No se publica un workspace ni se envían resultados a servicios externos. Los informes locales con cuerpos de respuesta deben permanecer fuera de Git.

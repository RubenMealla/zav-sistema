# Verificación de la base inicial del backend — E2

**Fecha de ejecución informada:** 24/09/2026. **Entorno:** API NestJS local y base PostgreSQL de la rama development de Neon. **Alcance:** autenticación de Administrador, productos y lotes con ingreso inicial.

## Evidencias de funcionamiento

- Se ejecutó la migración inicial; el script de verificación informó 6 tablas, 7 claves foráneas, 4 ubicaciones y una migración registrada. También se visualizaron las tablas en Neon.
- Se creó la primera cuenta de Administrador y se comprobó el inicio de sesión, la consulta de perfil con JWT y el rechazo de contraseña incorrecta y acceso sin token (401).
- Se registró y consultó un producto de demostración y un lote retenido con 20 paquetes físicos y 0 comprometidos.
- Al repetir la misma solicitud de lote con la misma clave de operación, la API devolvió el mismo identificador. La consulta de Neon mostró un solo movimiento de ingreso por 20 paquetes.
- Al reutilizar esa clave con una cantidad distinta, la API devolvió 409 y se mantuvieron las existencias iniciales.
- Se ejecutó localmente `apps/api/scripts/probar-inventario.ps1 -Development`: **11 comprobaciones correctas, 0 fallidas**. El resultado incluyó registro sin token (401), código de producto repetido (409), cantidad cero (400), fecha de vencimiento incorrecta (400), registro y consulta de lote, reintento idéntico sin duplicación y listado del lote. El script se conserva como herramienta local y no se incorpora al repositorio.
- Tras corregir las advertencias y la inyección de dependencias del inventario, la compilación y el lint finalizaron correctamente; se ejecutaron 11 pruebas unitarias y una prueba E2E inicial del endpoint raíz, todas correctas.

## Límites de la evidencia y pendientes

Las comprobaciones anteriores documentan los casos ejecutados en development. **No equivalen a una auditoría completa ni demuestran** autorización con una cuenta VENDEDOR real, reversión ante un fallo interno producido a mitad de la transacción, cobertura E2E de todas las rutas empresariales, concurrencia bajo carga ni despliegue productivo. Estas verificaciones quedan pendientes para las siguientes etapas.

Los códigos usados para las pruebas se identificaron como demostración. No se incluyen credenciales, cadenas de conexión ni tokens de acceso en este documento.

## Trazabilidad

- PR de la base inicial: https://github.com/RubenMealla/zav-sistema/pull/12
- Seguimiento de la actividad: https://trello.com/c/QUUvEt50

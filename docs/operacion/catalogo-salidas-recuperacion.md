# Implantación y recuperación de catálogo y salidas

Estado al 28/10/2026: código en rama de desarrollo; producción no migrada ni promovida. No ejecutar este procedimiento suponiendo que los identificadores históricos siguen vigentes.

## Identificación y controles previos

| Recurso | Referencia verificada / límite |
|---|---|
| Git | Base `e9dc1a40476a72034f38e4dabb0e178c62af0066`; rama `desarrollo/ventas-directas-catalogo`; PR [74](https://github.com/RubenMealla/zav-sistema/pull/74), sin merge |
| Neon producción | Proyecto `fancy-darkness-96751098`, rama `br-dry-hat-b6mxo2xi`, base `neondb`; siete migraciones originales |
| Neon ensayo | Rama `br-dawn-cake-b6cs8va8`, `ensayo-catalogo-salidas-20261012`; once migraciones verificadas |
| Render producción | Servicio `srv-das2iq3ncjis73fk6pc0`; despliegue anterior identificado `dep-db6mk9qd0e5s73ass9hg`, commit base |
| Vercel producción | Proyecto `prj_RVYDJQxTxfCmFe3ak2AXgcpwuHwL`; despliegue previo `dpl_928EeqAEWwUUuZdzNoRXrvEreHxh`, commit base; registro GitHub `7025576853` |
| Android producción / QA | `bo.zav.gestion.vendedor` / `bo.zav.gestion.vendedor.qa`; versión nueva 1.1.0, build 10100 |

Los plugins Render, Neon y Vercel vuelven a figurar instalados el 29/10, pero sus herramientas administrativas no están expuestas a esta sesión. El acceso alternativo al navegador tampoco está disponible. Hay acceso GitHub mediante el gestor local de credenciales y acceso SQL previamente configurado a Neon. La API pública responde, pero eso no prueba qué base usa el servicio ni su commit actual. Falta refrescar desde la configuración administrativa los despliegues, variables y conexiones antes de promover código o migrar producción. Es un impedimento técnico de acceso, no una solicitud adicional de autorización. Trello no está accesible durante esta continuación.

## Copias de datos verificadas

Los archivos contienen datos empresariales y permanecen en `backups/`, excluido de Git y de artefactos públicos.

| Copia | SHA-256 | Restauración comprobada |
|---|---|---|
| `catalogo-salidas-20261012/production-previa.dump` | `622c172c99ce5d41c6d2720201698136c78bc19df7c22470ae1423d65cdaa662` | `zav_restore_catalogo_20261012` |
| `catalogo-salidas-20261028/production-previa.dump` | `e84df3bad5a9a18ca3bf718ec1045fd5e512c63d7c1b390ded29382b35a579c1` | `zav_restore_catalogo_20261028` |

La segunda copia se tomó a `2026-10-28T20:58:58.123Z`, mediante `respaldo-verificable.mjs`: formato custom de PostgreSQL, conexión directa, creación de una base local nueva y comparación de huellas antes/después/restauradas para las diez tablas originales. `sourceStable=true`, `matches=true`. Informes privados `verificacion.json`, `migracion-restauracion.json` y `migracion-neon-ensayo.json` en la carpeta de la copia. Las cuatro migraciones conservaron las huellas históricas, sin saldos negativos ni SKU sin relación; siete familias y trece productos publicados. Una futura ventana productiva requiere otra copia reciente si hubo escrituras desde esta captura.

## Secuencia de implantación pendiente

1. Obtener de los servicios las versiones, ramas, endpoints y destinos de variables; registrar identificadores sin publicar secretos. Contrastarlos con Neon. QA debe usar la rama de ensayo, nunca producción. Registrar el valor esperado de los hosts por entorno.
2. Desplegar la API de esta rama en un servicio QA aislado y la web Preview con `API_BASE_URL` de esa API. Comprobar autenticación, catálogo público, ventas, recepción y devolución. Las pruebas destructivas automatizadas siguen limitadas a PostgreSQL local `zav_test`.
3. Acordar técnicamente una ventana sin escrituras, generar copia nueva y restaurarla en una base nueva. Ensayar de nuevo si cambió código, esquema o datos. El script de respaldo rechaza URL pooled, bases de restauración ajenas y sobrescritura de archivos.
4. Aplicar las cuatro migraciones en orden con TypeORM, `synchronize:false`, tabla `typeorm_migraciones`, `migrationsTransactionMode:'all'`, conexión explícita previamente contrastada. No utilizar el comando de development como atajo productivo. El inicio de producción no ejecuta migraciones automáticamente salvo configuración explícita de development.
5. Verificar once migraciones, restricciones, huellas de columnas históricas, siete familias/trece productos públicos, ausencia de negativos y conciliación. Ante error, la transacción debe fallar completa; investigar antes de reintentar.
6. Desplegar la API desde el SHA aprobado de esta rama; luego web desde el mismo SHA. No cambiar `main` ni fusionar. Verificar `/api/v1/salud`, `/api/v1/version`, `/api/v1/publico/catalogo` y proyección pública sin datos internos. Probar operaciones con datos autorizados sin inventar ventas empresariales.
7. Validar pesos, empaques y precios reales antes de habilitar nuevos SKU. Configurar las coordenadas reales de `VENTA_DESPACHO` desde Distribución. No copiar coordenadas sintéticas de pruebas.
8. Publicar la APK release solo tras comprobar su conexión a la API compatible. La compilación release de esta rama por sí sola no acredita que producción ya soporte sus rutas nuevas.

## Retorno del código

La copia local `zav_compat_catalogo_20261028`, derivada del respaldo restaurado y migrado, ejecutó el código anterior real `e9dc1a4`: login, alta de cliente sintético, pedido, retiro, entrega con GPS y dos reintentos sin duplicación. El lote de prueba pasó de 10 a 7 unidades y tuvo un único retiro/entrega. Script reproducible: `apps/api/scripts/verificar-api-anterior.mjs`; evidencia privada `backups/compatibilidad-api-anterior.json`. El respaldo certificado no se modificó para esta prueba.

Este resultado no autoriza ignorar operaciones nuevas pendientes. Antes de volver al código anterior:

1. Suspender escrituras de web y móvil; conservar copia posterior al incidente y exportar operaciones, asignaciones y movimientos afectados.
2. Resolver o inmovilizar cargas sin recepción, devoluciones pendientes y custodia libre. La versión antigua no dispone de sus pantallas de gestión. Conservar un backend compatible de administración aislado si se necesita cerrar estos estados.
3. Reponer los despliegues anteriores por identificador/SHA y sus variables verificadas. Conservar las tablas nuevas y todos los movimientos: el saldo se deriva de origen y destino, no de borrar operaciones nuevas.
4. Revisar disponibilidad y conciliación antes de reabrir. Los SKU nuevos permanecen PROVISIONAL hasta validación; la API antigua no tiene esa validación. No quitar los controles SQL para permitir operaciones provisionales.

No ejecutar `down` para borrar catálogo u operaciones. Las migraciones rechazan una reversión destructiva. Una reversión de salida empresarial exige recepción física y movimiento auditado hacia inspección.

## Recuperación de datos

Restaurar código no recupera datos. Si se necesita recuperar PostgreSQL, restaurar el dump en una **base o rama nueva**, usando `pg_restore --exit-on-error --no-owner --no-privileges`; nunca sobrescribir directamente production. Comprobar hash, conteos, integridad y huellas. Conciliar todas las operaciones legítimas posteriores al respaldo antes de cambiar la conexión. Conservar la base incidente para auditoría. Solo cambiar el destino de la API después de validar esa conciliación y registrar el nuevo endpoint. No destruir la rama anterior ni su historial.

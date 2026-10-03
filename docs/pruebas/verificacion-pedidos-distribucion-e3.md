# Verificación E3 — Cliente, Pedido, Retiro y Entrega

**Fecha:** 3 de octubre de 2026  
**Rama:** `desarrollo/e3-pedidos-distribucion`  
**Issue:** #32  
**Datos:** sintéticos de QA; no representan operaciones reales de ZAV.

## Alcance

Se verificó el backend correspondiente a Cliente, Pedido, disponibilidad comercial, Retiro y Entrega con GPS puntual, además de regresión del inventario administrativo.

## Ejecución fallida conservada

GitHub Actions: **QA backend #37100404491**.

Resultado:
- lint: completado;
- build: completado;
- unitarias: 11/11;
- E2E: falló antes de ejecutar los casos funcionales.

Diagnóstico: NestJS no pudo resolver `UsuarioEntityRepository` requerido por `JwtAuthGuard` dentro de `PedidosModule`. La causa fue importar `AuthModule` sin registrar `UsuarioEntity` en el contexto del nuevo módulo.

Corrección: se añadió `TypeOrmModule.forFeature([UsuarioEntity])` en `PedidosModule`. También se eliminaron dos advertencias de lint y se reforzó la idempotencia de la entrega para rechazar una misma clave reutilizada con coordenadas diferentes.

## Regresión posterior

GitHub Actions: **QA backend #37100513647**.

| Verificación | Obtenido |
|---|---|
| Lint API | 0 warnings / 0 errores |
| Compilación NestJS | Correcta |
| Pruebas unitarias | 11/11 |
| Archivos E2E | 3/3 |
| Pruebas E2E | 18/18 |
| Suite pedidos-distribución | 7/7 |
| Suite permisos/inventario | 8/8 |

Comando reproducible:

```bash
pnpm --filter @zav/api test:e2e
```

El workflow usa PostgreSQL 18 aislado en la base `zav_test`; el global setup rechaza cualquier URL que no apunte a esa base local.

## Casos de la suite nueva

| Caso | Camino / error comprobado |
|---|---|
| Autorización de Cliente | Administrador en ruta exclusiva Vendedor → 403; dirección vacía → 400 |
| Cliente | Vendedor registra y consulta Cliente |
| Producto/disponibilidad | Vendedor puede leer; edición sigue devolviendo 403 |
| Pedido | Reserva disponibilidad; intento de sobreventa → 409 |
| Estado/GPS | Entrega antes de Retiro → 409; latitud fuera de rango → 400 |
| Protección de reserva | Traslado o bloqueo administrativo que consumiría reserva → 409 |
| Distribución | Pedido → Retiro → Entrega; reintentos no duplican RETIRO ni ENTREGA |

## Migración de esquema

La migración `1790470800000-pedidos-distribucion.mjs` fue aplicada en la rama Neon aislada `qa-pedidos-e3`. La rama conservó los 14 productos, 14 lotes y 15 movimientos preexistentes, incorporó Cliente/Pedido/DetallePedido y registró la quinta migración sin alterar los datos previos.

## Estado

**IMPLEMENTADO EN RAMA + QA AUTOMATIZADO.** Falta integrar, migrar los entornos reales, desplegar la API y verificarla públicamente antes de marcar los Must como producción.

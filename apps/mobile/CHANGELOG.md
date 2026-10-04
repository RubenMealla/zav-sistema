# Changelog · ZAV Vendedor

Este archivo registra versiones funcionales de la aplicación móvil. Se utiliza versionamiento semántico `MAJOR.MINOR.PATCH`.

## [1.0.0] - 2026-10-04

Primera versión funcional estable del alcance E3 para el rol **Vendedor**.

### Funcionalidades principales

- autenticación exclusiva del rol Vendedor;
- gestión y georreferenciación de Clientes;
- activación/desactivación lógica de Clientes;
- registro y edición de Pedidos mientras permanecen en estado REGISTRADO;
- anulación auditable de Pedidos REGISTRADO;
- retiro individual y múltiple;
- organización de recorrido por cercanía;
- incorporación de nuevos Pedidos a un recorrido activo;
- mapa de destinos y paradas;
- confirmación individual de entrega con ubicación;
- Historial separado para Pedidos ENTREGADO/CANCELADO;
- notificaciones operativas temporales;
- selectores buscables de Cliente y productos;
- exclusión de productos sin stock del selector de Pedido;
- Safe Area superior e inferior;
- identidad visual **ZAV Vendedor** e icono de marca.

### Identidad técnica

- App: **ZAV Vendedor**
- Versión: **1.0.0**
- Android versionCode: **10000**
- iOS buildNumber: **10000**
- Identificador: `bo.zav.gestion.vendedor`

### Calidad

La versión fue sometida a QA móvil, QA backend y pruebas E2E/Playwright del repositorio. El estudiante reportó validación física satisfactoria en Android antes del cierre de la rama E3.

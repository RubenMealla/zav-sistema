# Prueba funcional de la ampliación

La ampliación está en el [PR 74](https://github.com/RubenMealla/zav-sistema/pull/74), todavía sin integrar. Producción conserva la versión anterior. Utilizar el entorno local o el QA que se configure con la base aislada; no realizar ventas ficticias en producción.

## Administrador

1. Entrar en **Catálogo**. Crear o editar una familia y un producto comercial. Los siete grupos y trece nombres/fotografías originales ya están importados en el ensayo. Activación y publicación son controles independientes.
2. En Presentaciones, seleccionar familia y producto; completar SKU, empaque, peso y precio. Un dato provisional no habilita operaciones. Validar comercialmente solo con información confirmada. Un SKU con historial no se redefine para representar otro artículo.
3. Publicar familia y producto y revisar la landing. Ocultarlos debe retirarlos del catálogo público; el inventario interno y los precios provisionales no aparecen. Para nuevas fotos, usar JPEG, PNG o WebP hasta 5 MB y 4096 píxeles por dimensión.
4. Configurar el punto real de despacho en Distribución. En **Venta directa**, elegir presentaciones disponibles, cantidades y revisar el resumen. Confirmar registra una salida definitiva con lotes FEFO, usuario y copia de coordenadas. No genera cobro ni factura.
5. En **Mercancía en distribución**, seleccionar vendedor y crear una carga libre. La carga pendiente ya salió físicamente del despacho, pero el vendedor no puede venderla hasta confirmar recepción.
6. Revisar historial y conciliación. Recibir devoluciones coloca los productos en `DEVOLUCIONES_INSPECCION`; no los vuelve automáticamente vendibles. Después de inspección, condición y vigencia válidas, el traslado auditado permite reintegrarlos.

## Vendedor Android

1. Instalar la APK **QA**, identificada con paquete distinto y etiqueta QA. Configurar la URL base de la API QA; para emulador local es `http://10.0.2.2:3001`, sin añadir `/api/v1`. No utilizar la API productiva para esta prueba.
2. Abrir la pestaña independiente **Venta directa**, después **Cargas y devolución**. Confirmar una carga propia tras verificar la recepción física.
3. En Nueva venta, seleccionar cantidades dentro del saldo libre propio. La mercancía de pedidos y de otros vendedores no está disponible para esta operación.
4. Obtener ubicación puntual y revisar precisión. Confirmar la entrega. La pantalla solo afirma registro exitoso cuando responde la API. Si falla la red, conservar la operación pendiente y usar su reintento: mantiene la misma clave y datos, incluso al reabrir. No crear otra solicitud para reemplazar una respuesta incierta.
5. Revisar Historial. Para sobrantes, elegir lotes/cantidades y un motivo; solicitar devolución. Quedan inmovilizados hasta la recepción administrativa, que los envía a inspección.
6. Verificar también el recorrido anterior de Clientes → Pedidos → Retiro → Distribución → Entrega GPS. No fue sustituido.

La APK release usa el identificador productivo y no habilita HTTP local. Compilarla no implica que la API productiva tenga ya desplegada esta ampliación. Los enlaces y resultados de pruebas se registran en `docs/pruebas/catalogo-salidas-directas.md`.

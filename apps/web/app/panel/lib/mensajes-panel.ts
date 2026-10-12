export const mensajes: Record<string, string> = {
  codigo: 'Ya existe un producto con ese código.',
  'lote-duplicado': 'El código de lote o la clave de operación ya está registrado.',
  'traslado-conflicto': 'No se pudo trasladar. Revisa el saldo disponible.',
  'condicion-conflicto': 'No se pudo cambiar la condición. Revisa estado, vigencia y producto.',
  conexion: 'No se pudo conectar con la API de ZAV. Comprueba la conexión e inténtalo nuevamente.',
  'solicitud-invalida': 'Hay datos incompletos o inválidos. Revisa los campos y vuelve a intentar.',
  'registro-no-encontrado': 'El registro ya no existe o cambió desde la última consulta. Actualiza la pantalla y vuelve a intentar.',
  servicio: 'El servicio de ZAV no pudo completar la operación. Inténtalo nuevamente; si persiste, revisa el estado de la API.',
  producto: 'No se registró el producto. Revisa los datos.',
  'producto-edicion': 'No se pudo actualizar el producto. Revisa los datos.',
  'producto-baja': 'No se pudo desactivar el producto.',
  lote: 'No se registró el lote. Comprueba fechas, ubicación y cantidad.',
  traslado: 'No se registró el traslado. Revisa lote, ubicaciones y cantidad.',
  condicion: 'No se cambió la condición del lote. Revisa los datos.',
  'despacho-geo': 'No se pudo guardar la ubicación geográfica de Venta y Despacho.',
};

export const mensajesOk: Record<string, string> = {
  producto: 'Producto registrado correctamente.',
  'producto-editado': 'Producto actualizado correctamente.',
  'producto-baja': 'Producto desactivado correctamente.',
  lote: 'Lote e ingreso inicial registrados correctamente.',
  traslado: 'Traslado registrado correctamente.',
  condicion: 'Condición del lote actualizada correctamente.',
  'despacho-geo': 'Ubicación geográfica de Venta y Despacho actualizada.',
  'sesion-iniciada': 'Sesión iniciada correctamente.',
};

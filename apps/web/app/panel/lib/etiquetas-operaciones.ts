const etiquetas: Record<string, string> = {
  SALIDA_DIRECTA: "Venta directa",
  CARGA: "Carga de mercancía",
  DEVOLUCION: "Devolución",
  REVERSION: "Devolución de una venta",
  CONFIRMADA: "Confirmada",
  PENDIENTE_RECEPCION: "Por recibir",
  LIBRE: "Venta directa",
  PEDIDO: "Reservado para pedidos",
  LIBERADO: "Liberado",
  BLOQUEADO: "Bloqueado",
  CUARENTENA: "En revisión",
  RECEPCION_CARGA: "Carga recibida",
  RECEPCION_DEVOLUCION: "Devolución recibida",
  CREACION: "Registrada",
};
export const etiquetaOperacion = (valor: string) =>
  etiquetas[valor] ?? valor.toLocaleLowerCase().replaceAll("_", " ");
export const fechaOperacion = (valor: string) =>
  new Date(valor).toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

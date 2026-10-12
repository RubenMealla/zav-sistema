const horaBolivia = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

// El registro conserva el ISO UTC; solo su presentación usa la zona de Bolivia.
export function formatearHoraQa(momento: string): string {
  const fecha = new Date(momento);
  return Number.isNaN(fecha.getTime()) ? '--:--:--' : horaBolivia.format(fecha);
}

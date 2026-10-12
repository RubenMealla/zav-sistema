const LIMITES_TABLA = [10, 20, 30, 50, 100, 150] as const;

export function limiteSeguro(valor: string | undefined): number {
  if (valor === undefined || !/^[1-9]\d*$/.test(valor)) return 20;
  const numero = Number(valor);
  return LIMITES_TABLA.includes(numero as (typeof LIMITES_TABLA)[number]) ? numero : 20;
}

export function paginaSegura(valor: string | undefined): number {
  if (valor === undefined || !/^[1-9]\d*$/.test(valor)) return 1;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero <= 100000 ? numero : 1;
}

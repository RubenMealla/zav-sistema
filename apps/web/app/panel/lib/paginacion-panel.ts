const LIMITES_TABLA = [10, 20, 30, 50, 100, 150] as const;
export function limiteSeguro(valor: string | undefined) {
  const numero = Number.parseInt(valor ?? '20', 10);
  return LIMITES_TABLA.includes(numero as (typeof LIMITES_TABLA)[number]) ? numero : 20;
}

export function paginaSegura(valor: string | undefined) {
  const numero = Number.parseInt(valor ?? '1', 10);
  return Number.isFinite(numero) && numero > 0 ? numero : 1;
}

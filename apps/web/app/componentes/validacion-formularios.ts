import type { FormEvent } from "react";

// HTML compila pattern con Unicode v: el guion literal debe estar escapado.
export const PATRON_CODIGO_SKU = "[A-Za-z0-9][A-Za-z0-9._\\-]{1,39}";
export const PATRON_CODIGO_LOTE = "[A-Za-z0-9][A-Za-z0-9._\\-]{1,59}";
export const PATRON_NOMBRE = "(?=.*\\p{L})[^\\p{Cc}\\p{Cf}<>]+";
export const PATRON_TEXTO_REQUERIDO = ".*\\S.*";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
function esControl(control: EventTarget): control is Control {
  return (
    control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement ||
    control instanceof HTMLTextAreaElement
  );
}
function mensaje(control: Control) {
  const v = control.validity;
  if (v.valueMissing) return "Completa este campo obligatorio.";
  if (v.patternMismatch)
    return control.dataset.validacion ?? "Revisa el formato de este campo.";
  if (v.tooShort && "minLength" in control)
    return `Ingresa al menos ${control.minLength} caracteres.`;
  if (v.tooLong && "maxLength" in control)
    return `Usa como máximo ${control.maxLength} caracteres.`;
  if (control instanceof HTMLInputElement) {
    if (v.rangeUnderflow)
      return control.type === "date"
        ? `Selecciona una fecha igual o posterior a ${control.min}.`
        : `El mínimo permitido es ${control.min}.`;
    if (v.rangeOverflow)
      return control.type === "date"
        ? `Selecciona una fecha igual o anterior a ${control.max}.`
        : `El máximo permitido es ${control.max}.`;
    if (v.stepMismatch)
      return "Ingresa un valor compatible con el formato solicitado.";
  }
  return "Revisa este campo antes de continuar.";
}
export function manejarInvalido(evento: FormEvent<HTMLFormElement>) {
  const control = evento.target;
  if (!esControl(control)) return;
  control.setCustomValidity("");
  control.setCustomValidity(`VALIDACIÓN · ${mensaje(control)}`);
}
export function limpiarInvalido(evento: FormEvent<HTMLFormElement>) {
  if (esControl(evento.target)) evento.target.setCustomValidity("");
}

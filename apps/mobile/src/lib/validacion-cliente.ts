export function validarDatosCliente(
  nombre: string,
  telefono: string,
): string | null {
  const n = nombre.trim().normalize("NFC");
  if (!n) return "El nombre del cliente es obligatorio.";
  if (n.length > 140 || !/\p{L}/u.test(n) || /[\p{Cc}\p{Cf}<>]/u.test(n))
    return "El nombre debe tener hasta 140 caracteres, contener letras y no incluir etiquetas ni caracteres invisibles.";
  const t = telefono.trim();
  if (!t) return null;
  const digitos = t.replace(/\D/g, "").length;
  if (
    t.length > 30 ||
    !/^\+?[0-9][0-9 ()-]*$/.test(t) ||
    digitos < 7 ||
    digitos > 15
  )
    return "El teléfono debe contener de 7 a 15 dígitos. Puedes usar + inicial, espacios, paréntesis y guiones, o dejarlo vacío.";
  return null;
}

'use server';

import { redirect } from 'next/navigation';
import { enviar, parametrosError } from './acciones';
import { claveErrorOperacion } from './errores-operacion';

export async function editarProducto(formulario: FormData) {
  const productoId = String(formulario.get('productoId') ?? '');
  const resultado = await enviar(
    `/api/v1/productos/${encodeURIComponent(productoId)}`,
    {
      codigo: String(formulario.get('codigo') ?? ''),
      nombre: String(formulario.get('nombre') ?? ''),
      familia: String(formulario.get('familia') ?? ''),
      presentacion: String(formulario.get('presentacion') ?? ''),
      pesoGramos: Number(formulario.get('pesoGramos')),
      precioBob: String(formulario.get('precioBob') ?? ''),
    },
    'PATCH',
  );

  if (resultado.estado === 401 || resultado.estado === 403) redirect(`/acceso?error=sesion&codigo=${resultado.estado}`);
  if (resultado.estado === 200) redirect('/panel?vista=productos&mensaje=producto-editado');

  redirect(`/panel?vista=productos&${parametrosError(resultado.estado, claveErrorOperacion(resultado.estado, 'producto-edicion', 'codigo'), resultado.detalle)}`);
}

export async function darBajaProducto(formulario: FormData) {
  const productoId = String(formulario.get('productoId') ?? '');
  const resultado = await enviar(
    `/api/v1/productos/${encodeURIComponent(productoId)}/baja`,
    {},
    'PATCH',
  );

  if (resultado.estado === 401 || resultado.estado === 403) redirect(`/acceso?error=sesion&codigo=${resultado.estado}`);
  if (resultado.estado === 200) redirect('/panel?vista=productos&mensaje=producto-baja');

  redirect(`/panel?vista=productos&${parametrosError(resultado.estado, claveErrorOperacion(resultado.estado, 'producto-baja'), resultado.detalle)}`);
}

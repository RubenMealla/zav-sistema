'use server';

import { redirect } from 'next/navigation';
import { enviar } from './acciones';

export async function editarProducto(formulario: FormData) {
  const productoId = String(formulario.get('productoId') ?? '');
  const estado = await enviar(
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

  if (estado === 401 || estado === 403) redirect('/acceso?error=sesion');
  if (estado === 200) redirect('/panel?vista=productos&mensaje=producto-editado');

  const error =
    estado === 409 ? 'codigo' : estado === 'conexion' ? 'conexion' : 'producto-edicion';
  redirect(`/panel?vista=productos&error=${error}`);
}

export async function darBajaProducto(formulario: FormData) {
  const productoId = String(formulario.get('productoId') ?? '');
  const estado = await enviar(
    `/api/v1/productos/${encodeURIComponent(productoId)}/baja`,
    {},
    'PATCH',
  );

  if (estado === 401 || estado === 403) redirect('/acceso?error=sesion');
  if (estado === 200) redirect('/panel?vista=productos&mensaje=producto-baja');

  const error = estado === 'conexion' ? 'conexion' : 'producto-baja';
  redirect(`/panel?vista=productos&error=${error}`);
}

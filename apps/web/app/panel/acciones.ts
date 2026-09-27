'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const API = process.env.API_BASE_URL ?? 'http://localhost:3001';

async function enviar(ruta: string, datos: Record<string, unknown>): Promise<number | 'conexion'> {
  const token = (await cookies()).get('zav_acceso')?.value;
  if (!token) redirect('/acceso?error=sesion');
  try {
    const r = await fetch(`${API}${ruta}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(datos), cache: 'no-store',
    });
    return r.status;
  } catch {
    return 'conexion';
  }
}

export async function registrarProducto(formulario: FormData) {
  const estado = await enviar('/api/v1/productos', {
    codigo: String(formulario.get('codigo') ?? ''),
    nombre: String(formulario.get('nombre') ?? ''),
    familia: String(formulario.get('familia') ?? ''),
    presentacion: String(formulario.get('presentacion') ?? ''),
    pesoGramos: Number(formulario.get('pesoGramos')),
    precioBob: String(formulario.get('precioBob') ?? ''),
  });
  if (estado === 401 || estado === 403) redirect('/acceso?error=sesion');
  if (estado === 201) { revalidatePath('/panel'); redirect('/panel?mensaje=producto'); }
  redirect(`/panel?error=${estado === 409 ? 'codigo' : estado === 'conexion' ? 'conexion' : 'producto'}`);
}

export async function registrarLote(formulario: FormData) {
  const estado = await enviar('/api/v1/lotes', {
    operacionClave: String(formulario.get('operacionClave') ?? ''),
    productoId: String(formulario.get('productoId') ?? ''),
    codigo: String(formulario.get('codigo') ?? ''),
    elaboradoEl: String(formulario.get('elaboradoEl') ?? ''),
    venceEl: String(formulario.get('venceEl') ?? ''),
    cantidadInicial: Number(formulario.get('cantidadInicial')),
    ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
  });
  if (estado === 401 || estado === 403) redirect('/acceso?error=sesion');
  if (estado === 201) { revalidatePath('/panel'); redirect('/panel?mensaje=lote'); }
  redirect(`/panel?error=${estado === 409 ? 'lote-duplicado' : estado === 'conexion' ? 'conexion' : 'lote'}`);
}

export async function registrarTraslado(formulario: FormData) {
  const loteId = String(formulario.get('loteId') ?? '');
  const referencia = String(formulario.get('referencia') ?? '').trim();
  const motivo = String(formulario.get('motivo') ?? '').trim();
  const datos: Record<string, unknown> = {
    operacionClave: String(formulario.get('operacionClave') ?? ''),
    loteId,
    origenCodigo: String(formulario.get('origenCodigo') ?? ''),
    destinoCodigo: String(formulario.get('destinoCodigo') ?? ''),
    cantidad: Number(formulario.get('cantidad')),
  };
  if (referencia) datos.referencia = referencia;
  if (motivo) datos.motivo = motivo;

  const estado = await enviar('/api/v1/movimientos/traslado', datos);
  if (estado === 401 || estado === 403) redirect('/acceso?error=sesion');
  if (estado === 201) {
    revalidatePath('/panel');
    redirect(`/panel?mensaje=traslado&historialLoteId=${encodeURIComponent(loteId)}#movimientos`);
  }
  redirect(`/panel?error=${estado === 409 ? 'traslado-conflicto' : estado === 'conexion' ? 'conexion' : 'traslado'}#movimientos`);
}


export async function cambiarCondicionLote(formulario: FormData) {
  const loteId = String(formulario.get('loteId') ?? '');
  const accion = String(formulario.get('accion') ?? '');
  const rutaAccion = accion === 'bloquear' ? 'bloquear' : 'liberar';
  const estado = await enviar(`/api/v1/lotes/${encodeURIComponent(loteId)}/${rutaAccion}`, {
    operacionClave: String(formulario.get('operacionClave') ?? ''),
    motivo: String(formulario.get('motivo') ?? ''),
  });
  if (estado === 401 || estado === 403) redirect('/acceso?error=sesion');
  if (estado === 201) {
    revalidatePath('/panel');
    redirect(`/panel?mensaje=condicion&historialCondicionLoteId=${encodeURIComponent(loteId)}#condiciones`);
  }
  redirect(`/panel?error=${estado === 409 ? 'condicion-conflicto' : estado === 'conexion' ? 'conexion' : 'condicion'}#condiciones`);
}

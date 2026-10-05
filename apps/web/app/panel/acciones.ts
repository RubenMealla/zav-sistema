'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API = process.env.API_BASE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://zav-api-2026.onrender.com' : 'http://localhost:3001');

export async function enviar(ruta: string, datos: Record<string, unknown>, metodo: 'POST' | 'PATCH' = 'POST'): Promise<number | 'conexion'> {
  const token = (await cookies()).get('zav_acceso')?.value;
  if (!token) redirect('/acceso?error=sesion');
  try {
    const r = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
      cache: 'no-store',
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
  if (estado === 201) {
    redirect('/panel?vista=productos&mensaje=producto');
  }
  redirect(`/panel?vista=productos&error=${estado === 409 ? 'codigo' : estado === 'conexion' ? 'conexion' : 'producto'}`);
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
  if (estado === 201) {
    redirect('/panel?vista=lotes&mensaje=lote');
  }
  redirect(`/panel?vista=lotes&error=${estado === 409 ? 'lote-duplicado' : estado === 'conexion' ? 'conexion' : 'lote'}`);
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
    redirect(`/panel?vista=movimientos&mensaje=traslado&historialLoteId=${encodeURIComponent(loteId)}`);
  }
  redirect(`/panel?vista=movimientos&error=${estado === 409 ? 'traslado-conflicto' : estado === 'conexion' ? 'conexion' : 'traslado'}`);
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
    redirect(`/panel?vista=condiciones&mensaje=condicion&historialCondicionLoteId=${encodeURIComponent(loteId)}`);
  }
  redirect(`/panel?vista=condiciones&error=${estado === 409 ? 'condicion-conflicto' : estado === 'conexion' ? 'conexion' : 'condicion'}`);
}


export async function configurarGeorreferenciaDespacho(formulario: FormData) {
  const ubicacionId = String(formulario.get('ubicacionId') ?? '');
  const latitud = Number(formulario.get('latitud'));
  const longitud = Number(formulario.get('longitud'));

  if (!ubicacionId || !Number.isFinite(latitud) || !Number.isFinite(longitud)) {
    redirect('/panel?vista=resumen&error=despacho-geo');
  }

  const estado = await enviar(
    `/api/v1/ubicaciones/${encodeURIComponent(ubicacionId)}/georreferencia`,
    { latitud, longitud },
    'PATCH',
  );
  if (estado === 401 || estado === 403) redirect('/acceso?error=sesion');
  if (estado === 200) redirect('/panel?vista=resumen&mensaje=despacho-geo');
  redirect(
    `/panel?vista=resumen&error=${
      estado === 'conexion' ? 'conexion' : 'despacho-geo'
    }`,
  );
}

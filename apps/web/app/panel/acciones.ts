'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { claveErrorOperacion, parametrosError } from './errores-operacion';

const API = process.env.API_BASE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://zav-api-2026.onrender.com' : 'http://localhost:3001');

export type ResultadoEnvio = { estado: number | 'conexion'; detalle?: string };

function extraerDetalle(cuerpo: unknown) {
  if (!cuerpo || typeof cuerpo !== 'object') return undefined;
  const mensaje = (cuerpo as { message?: unknown }).message;
  if (Array.isArray(mensaje)) {
    const partes = mensaje.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return partes.length ? partes.join(' ') : undefined;
  }
  return typeof mensaje === 'string' && mensaje.trim() ? mensaje.trim() : undefined;
}

export async function enviar(ruta: string, datos: Record<string, unknown>, metodo: 'POST' | 'PATCH' = 'POST'): Promise<ResultadoEnvio> {
  const token = (await cookies()).get('zav_acceso')?.value;
  if (!token) redirect('/acceso?error=sesion&codigo=401');
  try {
    const r = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
      cache: 'no-store',
    });
    let detalle: string | undefined;
    if (!r.ok) {
      try {
        detalle = extraerDetalle(await r.clone().json());
      } catch {
        detalle = undefined;
      }
    }
    return { estado: r.status, detalle };
  } catch {
    return { estado: 'conexion', detalle: 'No fue posible obtener una respuesta de la API.' };
  }
}

export async function registrarProducto(formulario: FormData) {
  const resultado = await enviar('/api/v1/productos', {
    codigo: String(formulario.get('codigo') ?? ''),
    nombre: String(formulario.get('nombre') ?? ''),
    familia: String(formulario.get('familia') ?? ''),
    presentacion: String(formulario.get('presentacion') ?? ''),
    pesoGramos: Number(formulario.get('pesoGramos')),
    precioBob: String(formulario.get('precioBob') ?? ''),
  });
  if (resultado.estado === 401 || resultado.estado === 403) redirect(`/acceso?error=sesion&codigo=${resultado.estado}`);
  if (resultado.estado === 201) {
    redirect('/panel?vista=productos&mensaje=producto');
  }
  redirect(`/panel?vista=productos&${parametrosError(resultado.estado, claveErrorOperacion(resultado.estado, 'producto', 'codigo'), resultado.detalle)}`);
}

export async function registrarLote(formulario: FormData) {
  const resultado = await enviar('/api/v1/lotes', {
    operacionClave: String(formulario.get('operacionClave') ?? ''),
    productoId: String(formulario.get('productoId') ?? ''),
    codigo: String(formulario.get('codigo') ?? ''),
    elaboradoEl: String(formulario.get('elaboradoEl') ?? ''),
    venceEl: String(formulario.get('venceEl') ?? ''),
    cantidadInicial: Number(formulario.get('cantidadInicial')),
    ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
  });
  if (resultado.estado === 401 || resultado.estado === 403) redirect(`/acceso?error=sesion&codigo=${resultado.estado}`);
  if (resultado.estado === 201) {
    redirect('/panel?vista=lotes&mensaje=lote');
  }
  redirect(`/panel?vista=lotes&${parametrosError(resultado.estado, claveErrorOperacion(resultado.estado, 'lote', 'lote-duplicado'), resultado.detalle)}`);
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

  const resultado = await enviar('/api/v1/movimientos/traslado', datos);
  if (resultado.estado === 401 || resultado.estado === 403) redirect(`/acceso?error=sesion&codigo=${resultado.estado}`);
  if (resultado.estado === 201) {
    redirect(`/panel?vista=movimientos&mensaje=traslado&historialLoteId=${encodeURIComponent(loteId)}`);
  }
  redirect(`/panel?vista=movimientos&${parametrosError(resultado.estado, claveErrorOperacion(resultado.estado, 'traslado', 'traslado-conflicto'), resultado.detalle)}`);
}

export async function cambiarCondicionLote(formulario: FormData) {
  const loteId = String(formulario.get('loteId') ?? '');
  const accion = String(formulario.get('accion') ?? '');
  const rutaAccion = accion === 'bloquear' ? 'bloquear' : 'liberar';
  const resultado = await enviar(`/api/v1/lotes/${encodeURIComponent(loteId)}/${rutaAccion}`, {
    operacionClave: String(formulario.get('operacionClave') ?? ''),
    motivo: String(formulario.get('motivo') ?? ''),
  });
  if (resultado.estado === 401 || resultado.estado === 403) redirect(`/acceso?error=sesion&codigo=${resultado.estado}`);
  if (resultado.estado === 201) {
    redirect(`/panel?vista=condiciones&mensaje=condicion&historialCondicionLoteId=${encodeURIComponent(loteId)}`);
  }
  redirect(`/panel?vista=condiciones&${parametrosError(resultado.estado, claveErrorOperacion(resultado.estado, 'condicion', 'condicion-conflicto'), resultado.detalle)}`);
}


export async function configurarGeorreferenciaDespacho(formulario: FormData) {
  const ubicacionId = String(formulario.get('ubicacionId') ?? '');
  const latitud = Number(formulario.get('latitud'));
  const longitud = Number(formulario.get('longitud'));

  if (!ubicacionId || !Number.isFinite(latitud) || !Number.isFinite(longitud)) {
    redirect('/panel?vista=resumen&error=despacho-geo&codigo=VALIDACION&detalle=La%20ubicaci%C3%B3n%20seleccionada%20no%20es%20v%C3%A1lida.');
  }

  const resultado = await enviar(
    `/api/v1/ubicaciones/${encodeURIComponent(ubicacionId)}/georreferencia`,
    { latitud, longitud },
    'PATCH',
  );
  if (resultado.estado === 401 || resultado.estado === 403) redirect(`/acceso?error=sesion&codigo=${resultado.estado}`);
  if (resultado.estado === 200) redirect('/panel?vista=resumen&mensaje=despacho-geo');
  redirect(
    `/panel?vista=resumen&${parametrosError(resultado.estado, claveErrorOperacion(resultado.estado, 'despacho-geo'), resultado.detalle)}`,
  );
}

'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API = process.env.API_BASE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://zav-api-2026.onrender.com' : 'http://localhost:3001');
const COOKIE = 'zav_acceso';

type RespuestaLogin = { accessToken?: string; usuario?: { rol?: string } };

export async function iniciarSesion(formulario: FormData) {
  const identificador = String(formulario.get('identificador') ?? '').trim();
  const contrasena = String(formulario.get('contrasena') ?? '');
  if (!identificador || !contrasena) redirect('/acceso?error=datos&codigo=VALIDACION');

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador, contrasena }),
      cache: 'no-store',
    });
  } catch {
    redirect('/acceso?error=conexion&codigo=RED');
  }
  if (!respuesta.ok) {
    const clave =
      respuesta.status === 400 ? 'datos'
      : respuesta.status === 401 ? 'credenciales'
      : respuesta.status === 403 ? 'permisos'
      : 'servicio';
    redirect(`/acceso?error=${clave}&codigo=${respuesta.status}`);
  }
  let datos: RespuestaLogin;
  try {
    datos = (await respuesta.json()) as RespuestaLogin;
  } catch {
    redirect('/acceso?error=servicio&codigo=RESPUESTA_INVALIDA');
  }
  if (!datos.accessToken || datos.usuario?.rol !== 'ADMINISTRADOR') {
    redirect('/acceso?error=permisos&codigo=403');
  }

  (await cookies()).set(COOKIE, datos.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  });
  redirect('/panel?mensaje=sesion-iniciada');
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
  redirect('/acceso?mensaje=sesion-cerrada');
}

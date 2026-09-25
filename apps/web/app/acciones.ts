'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API = process.env.API_BASE_URL ?? 'http://localhost:3001';
const COOKIE = 'zav_acceso';

type RespuestaLogin = { accessToken?: string; usuario?: { rol?: string } };

export async function iniciarSesion(formulario: FormData) {
  const identificador = String(formulario.get('identificador') ?? '').trim();
  const contrasena = String(formulario.get('contrasena') ?? '');
  if (!identificador || !contrasena) redirect('/acceso?error=datos');

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador, contrasena }),
      cache: 'no-store',
    });
  } catch {
    redirect('/acceso?error=conexion');
  }
  if (!respuesta.ok) redirect('/acceso?error=credenciales');
  const datos = (await respuesta.json()) as RespuestaLogin;
  if (!datos.accessToken || datos.usuario?.rol !== 'ADMINISTRADOR') {
    redirect('/acceso?error=permisos');
  }

  (await cookies()).set(COOKIE, datos.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  });
  redirect('/panel');
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
  redirect('/acceso');
}

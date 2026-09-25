import Link from 'next/link';
import { iniciarSesion } from '../acciones';

const errores: Record<string, string> = {
  datos: 'Completa el identificador y la contraseña.',
  credenciales: 'No fue posible iniciar sesión. Verifica los datos de acceso.',
  permisos: 'Esta pantalla está disponible para el Administrador.',
  conexion: 'No se pudo conectar con la API. Comprueba que NestJS esté encendido.',
  sesion: 'La sesión terminó o ya no es válida. Vuelve a ingresar.',
};

export default async function Acceso({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="acceso-fondo">
      <section className="acceso-caja"><Link href="/" className="volver">← Volver al inicio</Link>
        <div className="marca acceso-marca"><span className="marca-simbolo">Z</span><span>ZAV <small>Área de administración</small></span></div>
        <span className="etiqueta">ACCESO PRIVADO</span><h1>Bienvenido de nuevo</h1>
        <p className="subtexto">Ingresa con tu cuenta administrativa para consultar y registrar productos y lotes.</p>
        {error && <p role="alert" className="alerta alerta-error">{errores[error] ?? 'No fue posible completar la solicitud.'}</p>}
        <form action={iniciarSesion} className="formulario"><label htmlFor="identificador">Identificador de acceso</label><input id="identificador" name="identificador" autoComplete="username" minLength={3} maxLength={120} required placeholder="Tu identificador" />
          <label htmlFor="contrasena">Contraseña</label><input id="contrasena" type="password" name="contrasena" autoComplete="current-password" required placeholder="Tu contraseña" />
          <button className="boton boton-oscuro boton-completo" type="submit">Iniciar sesión →</button></form>
        <p className="nota">La sesión caduca tras 15 minutos. Las credenciales se verifican mediante la API de ZAV.</p>
      </section>
    </main>
  );
}

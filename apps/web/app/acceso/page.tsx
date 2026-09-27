import Link from 'next/link';
import { iniciarSesion } from '../acciones';
import { CampoContrasena } from '../componentes/interacciones';
import { Icono } from '../componentes/icono';

const errores: Record<string, string> = {
  datos: 'Completa el identificador y la contraseña.',
  credenciales: 'No fue posible iniciar sesión. Verifica los datos de acceso.',
  permisos: 'Esta pantalla está disponible para el Administrador.',
  conexion: 'No se pudo conectar con la API de ZAV.',
  sesion: 'La sesión terminó o ya no es válida. Vuelve a ingresar.',
};

export default async function Acceso({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="acceso-layout">
      <section className="acceso-presentacion">
        <Link className="logo logo-invertido" href="/" aria-label="ZAV, inicio">
          <span className="logo-marca">Z</span>
          <span>ZAV <small>Administración</small></span>
        </Link>

        <div className="acceso-presentacion-contenido">
          <span className="eyebrow eyebrow-claro">GESTIÓN INTERNA</span>
          <h1>Todo el inventario, con el contexto que necesitas para decidir.</h1>
          <p>Acceso protegido al panel administrativo de productos terminados.</p>

          <div className="acceso-beneficios">
            <div><span><Icono nombre="escudo" /></span><div><strong>Acceso controlado</strong><p>Sesión administrativa verificada por la API.</p></div></div>
            <div><span><Icono nombre="historial" /></span><div><strong>Operaciones trazables</strong><p>Movimientos y decisiones quedan vinculados al usuario.</p></div></div>
            <div><span><Icono nombre="ubicacion" /></span><div><strong>Inventario por ubicación</strong><p>Consulta rápida de existencias y traslados.</p></div></div>
          </div>
        </div>

        <p className="acceso-presentacion-pie">ZAV · Tarija, Bolivia · 2026</p>
      </section>

      <section className="acceso-panel">
        <div className="acceso-formulario-caja">
          <Link href="/" className="volver"><span>←</span> Volver al inicio</Link>
          <div className="acceso-titulo">
            <span className="eyebrow">ACCESO PRIVADO</span>
            <h2>Bienvenido de nuevo</h2>
            <p>Ingresa con tu cuenta de Administrador para continuar.</p>
          </div>

          {error && (
            <div role="alert" className="mensaje-inline mensaje-error">
              <span><Icono nombre="alerta" tamano={18} /></span>
              <p>{errores[error] ?? 'No fue posible completar la solicitud.'}</p>
            </div>
          )}

          <form action={iniciarSesion} className="formulario acceso-formulario">
            <label className="campo" htmlFor="identificador">
              <span>Identificador de acceso</span>
              <input
                id="identificador"
                name="identificador"
                autoComplete="username"
                minLength={3}
                maxLength={120}
                required
                placeholder="Ingresa tu identificador"
              />
            </label>
            <CampoContrasena />
            <button className="boton boton-primario boton-completo boton-grande" type="submit">
              Iniciar sesión <Icono nombre="flecha" tamano={17} />
            </button>
          </form>

          <div className="acceso-seguridad">
            <Icono nombre="escudo" tamano={16} />
            <p>La sesión caduca tras 15 minutos. Las credenciales se validan de forma segura mediante la API de ZAV.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

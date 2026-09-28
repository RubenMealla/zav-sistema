import Link from 'next/link';
import { Marca } from '../componentes/marca';
import { iniciarSesion } from '../acciones';
import { BotonEnviar, CampoContrasena } from '../componentes/interacciones';
import { Icono } from '../componentes/icono';

const errores: Record<string, string> = {
  datos: 'Completa el identificador y la contraseña.',
  credenciales: 'No fue posible iniciar sesión. Verifica los datos de acceso.',
  permisos: 'Esta pantalla está disponible para el Administrador.',
  conexion: 'No se pudo conectar con el servicio de ZAV.',
  sesion: 'La sesión terminó o ya no es válida. Vuelve a ingresar.',
};

export default async function Acceso({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="acceso-layout">
      <section className="acceso-presentacion" aria-label="ZAV, gestión interna">
        <div className="acceso-identificador"><span>FIAMBRES &amp; EMBUTIDOS</span><span>2026</span></div>
        <div className="acceso-presentacion-contenido">
          <Link href="/" aria-label="ZAV, inicio"><Marca etiqueta grande /></Link>
          <h1>Productos terminados.<br />Información en orden.</h1>
          <p>Inventario, condición de lotes y movimientos en un mismo lugar.</p>
        </div>
        <p className="acceso-presentacion-pie">ZAV · Tarija, Bolivia</p>
      </section>
      <section className="acceso-panel" aria-labelledby="acceso-titulo">
        <div className="acceso-formulario-caja">
          <Link href="/" aria-label="ZAV, inicio" className="acceso-marca-movil"><Marca /></Link>
          <Link href="/" className="volver"><span aria-hidden="true">←</span> Volver al inicio</Link>
          <div className="acceso-titulo">
            <span className="eyebrow">ACCESO ADMINISTRATIVO</span>
            <h2 id="acceso-titulo">Ingresa a tu espacio de trabajo</h2>
            <p>Utiliza tu cuenta de Administrador para continuar.</p>
          </div>
          {error && (
            <div role="alert" className="mensaje-inline mensaje-error">
              <Icono nombre="alerta" tamano={18} />
              <p>{errores[error] ?? 'No fue posible completar la solicitud.'}</p>
            </div>
          )}
          <form action={iniciarSesion} className="formulario acceso-formulario">
            <label className="campo" htmlFor="identificador">
              <span>Identificador de acceso</span>
              <input id="identificador" name="identificador" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={120} required placeholder="Ingresa tu identificador" />
            </label>
            <CampoContrasena />
            <BotonEnviar className="boton boton-primario boton-completo boton-grande" pendiente="Ingresando…">Iniciar sesión <Icono nombre="flecha" tamano={17} /></BotonEnviar>
          </form>
          <div className="acceso-seguridad"><Icono nombre="escudo" tamano={18} /><p>Acceso exclusivo del personal autorizado. Por seguridad, la sesión caduca tras 15 minutos.</p></div>
        </div>
      </section>
    </main>
  );
}

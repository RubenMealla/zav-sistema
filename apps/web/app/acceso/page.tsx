import Link from 'next/link';
import { iniciarSesion } from '../acciones';
import { BotonEnviar, CampoContrasena } from '../componentes/interacciones';
import { Icono } from '../componentes/icono';
import { Marca } from '../componentes/marca';

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
      <section className="acceso-identidad" aria-label="ZAV, acceso interno">
        <div className="acceso-identidad-cabecera">
          <Link href="/" aria-label="ZAV, inicio" className="acceso-identidad-marca"><Marca compacta /></Link>
          <span>GESTIÓN INTERNA</span>
        </div>
        <div className="acceso-identidad-centro">
          <div className="acceso-producto-visual"><Marca grande /></div>
          <div className="acceso-identidad-copy">
            <span>ADMINISTRACIÓN / ZAV</span>
            <h2>Acceso interno.</h2>
            <p>Entorno reservado para la gestión administrativa de ZAV.</p>
          </div>
        </div>
        <div className="acceso-identidad-pie"><span>Tarija · Bolivia</span><span>Personal autorizado</span></div>
      </section>

      <section className="acceso-panel" aria-labelledby="acceso-titulo">
        <div className="acceso-panel-superior"><Link href="/" className="volver"><span aria-hidden="true">←</span> Volver al sitio</Link></div>
        <div className="acceso-formulario-caja">
          <Link href="/" aria-label="ZAV, inicio" className="acceso-marca-movil"><Marca compacta /></Link>
          <div className="acceso-titulo">
            <span className="eyebrow">SISTEMA ADMINISTRATIVO</span>
            <h1 id="acceso-titulo">Iniciar sesión</h1>
            <p>Ingresa con tu cuenta de Administrador.</p>
          </div>
          {error && <div role="alert" className="mensaje-inline mensaje-error"><Icono nombre="alerta" tamano={18} /><p>{errores[error] ?? 'No fue posible completar la solicitud.'}</p></div>}
          <form action={iniciarSesion} className="formulario acceso-formulario">
            <label className="campo" htmlFor="identificador"><span>Identificador</span><input id="identificador" name="identificador" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={120} required placeholder="Correo o identificador" /></label>
            <CampoContrasena />
            <BotonEnviar className="boton boton-primario boton-completo" pendiente="Ingresando…">Ingresar al sistema <Icono nombre="flecha" tamano={16} /></BotonEnviar>
          </form>
          <div className="acceso-seguridad"><Icono nombre="escudo" tamano={17} /><p>Acceso exclusivo del personal autorizado.</p></div>
        </div>
        <p className="acceso-panel-pie">ZAV · Sistema de gestión</p>
      </section>
    </main>
  );
}

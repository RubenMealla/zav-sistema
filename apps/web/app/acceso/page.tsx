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
      <section className="acceso-escena" aria-label="ZAV, acceso interno">
        <div className="acceso-escena-superior">
          <Link href="/" aria-label="ZAV, inicio" className="acceso-marca-integrada">
            <Marca compacta />
            <span><strong>ZAV</strong><small>Fiambres &amp; embutidos</small></span>
          </Link>
          <span>GESTIÓN INTERNA</span>
        </div>

        <div className="acceso-escena-contenido">
          <span className="acceso-linea" />
          <h2>Gestión clara para la operación diaria.</h2>
          <p>Inventario, lotes, condiciones, movimientos y pedidos en un entorno reservado para el personal autorizado.</p>
        </div>

        <div className="acceso-escena-marca"><Marca etiqueta grande /></div>
        <div className="acceso-escena-pie"><span>Tarija, Bolivia</span><span>Sistema ZAV</span></div>
      </section>

      <section className="acceso-panel" aria-labelledby="acceso-titulo">
        <div className="acceso-panel-superior">
          <Link href="/" className="volver"><span aria-hidden="true">←</span> Volver al sitio</Link>
        </div>

        <div className="acceso-formulario-caja">
          <Link href="/" aria-label="ZAV, inicio" className="acceso-marca-movil"><Marca compacta /><span>ZAV</span></Link>
          <div className="acceso-titulo">
            <span className="eyebrow">SISTEMA ADMINISTRATIVO</span>
            <h1 id="acceso-titulo">Inicia sesión.</h1>
            <p>Ingresa con tu cuenta de Administrador para continuar al panel de gestión.</p>
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
            <BotonEnviar className="boton boton-primario boton-completo boton-grande" pendiente="Ingresando…">
              Ingresar al sistema <Icono nombre="flecha" tamano={17} />
            </BotonEnviar>
          </form>

          <div className="acceso-seguridad">
            <Icono nombre="escudo" tamano={18} />
            <p>Acceso exclusivo del personal autorizado. La sesión expira automáticamente por seguridad.</p>
          </div>
        </div>

        <p className="acceso-panel-pie">ZAV · Gestión interna</p>
      </section>
    </main>
  );
}

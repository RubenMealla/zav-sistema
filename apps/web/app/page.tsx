import Link from 'next/link';
import { configuracionPublica } from './configuracion-publica';
import { Icono } from './componentes/icono';
import { Marca } from './componentes/marca';

const operaciones = [
  { numero: '01', titulo: 'Productos y lotes', texto: 'Presentaciones, fechas de vencimiento y existencias de productos terminados.' },
  { numero: '02', titulo: 'Condición comercial', texto: 'Liberación y bloqueo de lotes con motivo y responsable.' },
  { numero: '03', titulo: 'Movimientos', texto: 'Ingresos y traslados entre ubicaciones operativas.' },
];

const seccionesPublicas = [
  { numero: '01', titulo: 'Catálogo', texto: 'Espacio preparado para productos, familias y presentaciones visibles al cliente.' },
  { numero: '02', titulo: 'Promociones', texto: 'Zona prevista para campañas comerciales con vigencia y contenido administrable.' },
  { numero: '03', titulo: 'Noticias', texto: 'Sección prevista para novedades e información institucional de ZAV.' },
];

export default function Inicio() {
  const mostrarLandingExtendida = configuracionPublica.landingExtendida;

  return (
    <div className="sitio-publico">
      <a className="saltar-contenido" href="#principal">Saltar al contenido</a>

      <header className="publico-header">
        <div className="contenedor-publico publico-header-interior">
          <Link href="/" aria-label="ZAV, inicio" className="publico-marca">
            <Marca compacta />
            <span><strong>ZAV</strong><small>Fiambres &amp; embutidos</small></span>
          </Link>

          {mostrarLandingExtendida ? (
            <nav className="publico-nav" aria-label="Navegación pública">
              <a href="#productos">Productos</a>
              <a href="#promociones">Promociones</a>
              <a href="#novedades">Noticias</a>
              <a href="#zav">Nosotros</a>
            </nav>
          ) : (
            <span className="publico-descriptor">Tarija · Bolivia</span>
          )}

          <Link className="publico-acceso" href="/acceso">
            Acceso interno <Icono nombre="flecha" tamano={15} />
          </Link>
        </div>
      </header>

      <main id="principal" tabIndex={-1}>
        <section className="publico-hero">
          <div className="contenedor-publico publico-hero-grid">
            <div className="publico-hero-contenido">
              <span className="publico-kicker">FIAMBRES &amp; EMBUTIDOS · TARIJA, BOLIVIA</span>
              <h1>Identidad de marca.<br /><em>Gestión con trazabilidad.</em></h1>
              <p>Un punto de entrada claro para ZAV: información pública cuando corresponda y acceso separado al sistema interno de gestión.</p>
              <div className="publico-hero-acciones">
                {mostrarLandingExtendida ? (
                  <a className="boton boton-primario boton-grande" href="#productos">
                    Explorar el sitio <Icono nombre="flecha" tamano={17} />
                  </a>
                ) : null}
                <Link className={mostrarLandingExtendida ? 'publico-boton-secundario' : 'boton boton-primario boton-grande'} href="/acceso">
                  Ingresar al sistema <Icono nombre="flecha" tamano={17} />
                </Link>
              </div>
              <span className="publico-nota"><Icono nombre="escudo" tamano={15} /> El sistema administrativo requiere autenticación.</span>
            </div>

            <div className="publico-hero-marca" aria-label="Identidad ZAV">
              <span className="publico-hero-marca-etiqueta">ZAV / 2026</span>
              <Marca etiqueta grande />
              <div className="publico-hero-marca-pie"><span>Fiambres &amp; embutidos</span><span>Tarija</span></div>
            </div>
          </div>
        </section>

        {mostrarLandingExtendida ? (
          <>
            <section id="productos" className="publico-seccion contenedor-publico publico-seccion-futura" aria-labelledby="productos-titulo">
              <header className="publico-seccion-cabecera">
                <div>
                  <span className="eyebrow">CATÁLOGO</span>
                  <h2 id="productos-titulo">Los productos pueden ser el centro de la experiencia pública.</h2>
                </div>
                <p>La estructura queda preparada para enlazar productos reales cuando el módulo público esté implementado.</p>
              </header>
              <div className="publico-futuro-grid">
                {seccionesPublicas.map((item) => (
                  <article key={item.numero}>
                    <span>{item.numero}</span>
                    <h3>{item.titulo}</h3>
                    <p>{item.texto}</p>
                    <small>Sección preparada</small>
                  </article>
                ))}
              </div>
            </section>

            <section id="promociones" className="publico-promo">
              <div className="contenedor-publico publico-promo-grid">
                <div>
                  <span className="publico-kicker">PROMOCIONES</span>
                  <h2>Un espacio propio para campañas, sin mezclarlo con la operación interna.</h2>
                </div>
                <p>Si el alcance lo permite, esta sección podrá conectarse a contenido administrable. Si no, puede ocultarse con una sola configuración sin eliminar el diseño.</p>
              </div>
            </section>

            <section id="novedades" className="publico-seccion contenedor-publico publico-novedades" aria-labelledby="novedades-titulo">
              <div>
                <span className="eyebrow">NOTICIAS / INFORMACIÓN</span>
                <h2 id="novedades-titulo">Contenido institucional con jerarquía y lectura clara.</h2>
              </div>
              <div className="publico-novedades-lista">
                <article><span>01</span><div><small>NOTICIAS</small><h3>Espacio para novedades de la empresa.</h3></div></article>
                <article><span>02</span><div><small>INFORMACIÓN</small><h3>Contenido útil para clientes y visitantes.</h3></div></article>
                <article><span>03</span><div><small>MARCA</small><h3>Comunicación institucional separada del sistema interno.</h3></div></article>
              </div>
            </section>
          </>
        ) : null}

        <section id="zav" className="publico-operaciones">
          <div className="contenedor-publico">
            <div className="publico-seccion-titulo">
              <span className="eyebrow">SISTEMA INTERNO</span>
              <h2>La gestión operativa permanece separada de la comunicación pública.</h2>
            </div>
            <div className="publico-registros">
              {operaciones.map((operacion) => (
                <article key={operacion.numero}>
                  <span className="publico-numero">{operacion.numero}</span>
                  <h3>{operacion.titulo}</h3>
                  <p>{operacion.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="publico-footer">
        <div className="contenedor-publico publico-footer-interior">
          <div className="publico-footer-marca"><Marca compacta /><span><strong>ZAV</strong><small>Fiambres &amp; embutidos</small></span></div>
          <span>Tarija, Bolivia · 2026</span>
          <Link href="/acceso">Acceso interno</Link>
        </div>
      </footer>
    </div>
  );
}

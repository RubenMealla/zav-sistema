import Link from 'next/link';
import { configuracionPublica } from './configuracion-publica';
import { Icono } from './componentes/icono';
import { Marca } from './componentes/marca';

const secciones = [
  { numero: '01', titulo: 'Catálogo', texto: 'Productos y presentaciones de ZAV.' },
  { numero: '02', titulo: 'Promociones', texto: 'Campañas y comunicaciones comerciales.' },
  { numero: '03', titulo: 'Noticias', texto: 'Novedades e información de la empresa.' },
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
            <nav className="publico-nav" aria-label="Navegación principal">
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
            <div className="publico-hero-copy">
              <span className="publico-kicker">TARIJA · BOLIVIA</span>
              <h1>Fiambres y embutidos <em>ZAV.</em></h1>
              <p>
                Sitio público de ZAV y punto de acceso al sistema interno de gestión.
              </p>
              <div className="publico-hero-acciones">
                {mostrarLandingExtendida && (
                  <a className="boton boton-primario boton-grande" href="#productos">
                    Explorar ZAV <Icono nombre="flecha" tamano={17} />
                  </a>
                )}
                <Link className="boton boton-inverso boton-grande" href="/acceso">
                  Acceso administrativo
                </Link>
              </div>
            </div>

            <div className="publico-hero-identidad" aria-label="Identidad ZAV">
              <div className="publico-hero-regla"><span>FIAMBRES</span><span>EMBUTIDOS</span></div>
              <Marca grande />
              <div className="publico-hero-pie"><span>ZAV</span><span>2026</span></div>
            </div>
          </div>
        </section>

        {mostrarLandingExtendida && (
          <>
            <section id="productos" className="publico-seccion publico-productos">
              <div className="contenedor-publico publico-productos-grid">
                <header className="publico-seccion-intro">
                  <span className="eyebrow">PRODUCTOS</span>
                  <h2>Catálogo público.</h2>
                  <p>
                    La estructura está preparada para publicar el catálogo cuando los productos
                    destinados al sitio público estén definidos y validados.
                  </p>
                </header>

                <div className="publico-indice">
                  {secciones.map((item) => (
                    <article key={item.numero}>
                      <span>{item.numero}</span>
                      <div>
                        <h3>{item.titulo}</h3>
                        <p>{item.texto}</p>
                      </div>
                      <b aria-hidden="true">↗</b>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section id="promociones" className="publico-promo">
              <div className="contenedor-publico publico-promo-grid">
                <div className="publico-promo-titulo">
                  <span>02 / PROMOCIONES</span>
                  <h2>Un espacio independiente para campañas vigentes.</h2>
                </div>
                <div className="publico-promo-texto">
                  <p>
                    Este bloque se habilitará con contenido real cuando exista una promoción
                    publicada para clientes.
                  </p>
                  <span>Contenido comercial administrable · pendiente de implementación</span>
                </div>
              </div>
            </section>

            <section id="novedades" className="publico-seccion publico-novedades">
              <div className="contenedor-publico publico-novedades-grid">
                <header className="publico-seccion-intro">
                  <span className="eyebrow">NOTICIAS</span>
                  <h2>Información sin ruido visual.</h2>
                  <p>
                    Noticias y comunicaciones de ZAV ocuparán este espacio cuando exista contenido
                    institucional validado.
                  </p>
                </header>

                <div className="publico-novedades-lista">
                  <article><time>01</time><h3>Novedades de productos</h3><span>Pendiente</span></article>
                  <article><time>02</time><h3>Información para clientes</h3><span>Pendiente</span></article>
                  <article><time>03</time><h3>Comunicaciones de ZAV</h3><span>Pendiente</span></article>
                </div>
              </div>
            </section>
          </>
        )}

        <section id="zav" className="publico-zav">
          <div className="contenedor-publico publico-zav-grid">
            <div className="publico-zav-identidad">
              <Marca grande />
            </div>
            <div className="publico-zav-copy">
              <span className="eyebrow">NOSOTROS</span>
              <h2>ZAV · Fiambres &amp; Embutidos.</h2>
              <p>
                Tarija, Bolivia. La información institucional detallada se incorporará únicamente
                con datos confirmados por la empresa.
              </p>
              <p>
                El contenido público y el sistema administrativo se mantienen separados para no
                mezclar comunicación comercial con la operación interna.
              </p>
              <Link className="publico-link" href="/acceso">
                Ir al sistema interno <Icono nombre="flecha" tamano={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="publico-footer">
        <div className="contenedor-publico publico-footer-interior">
          <div className="publico-footer-marca"><Marca compacta /><strong>ZAV</strong></div>
          <span>Tarija, Bolivia</span>
          <Link href="/acceso">Acceso interno</Link>
        </div>
      </footer>
    </div>
  );
}

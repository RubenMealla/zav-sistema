import Image from 'next/image';
import Link from 'next/link';
import { Icono } from './componentes/icono';
import { Marca } from './componentes/marca';

const productosReferencia = [
  {
    titulo: 'Producto destacado',
    subtitulo: 'Catálogo futuro',
    imagen: '/demo/producto-destacado-demo.webp',
  },
  {
    titulo: 'Selección de embutidos',
    subtitulo: 'Vista referencial',
    imagen: '/demo/productos-demo.webp',
  },
  {
    titulo: 'Proceso y elaboración',
    subtitulo: 'Contenido institucional futuro',
    imagen: '/demo/produccion-demo.webp',
  },
];

const novedadesReferencia = [
  { categoria: 'NOVEDAD', titulo: 'Espacio para comunicar lanzamientos y nuevas presentaciones' },
  { categoria: 'PROMOCIÓN', titulo: 'Campañas comerciales con vigencia, imagen y llamada a la acción' },
  { categoria: 'INFORMACIÓN', titulo: 'Avisos, noticias y contenido de interés para clientes' },
];

export default function Inicio() {
  return (
    <div className="sitio-publico">
      <a className="saltar-contenido" href="#principal">Saltar al contenido</a>

      <header className="publico-header">
        <div className="contenedor-publico publico-header-interior">
          <Link href="/" aria-label="ZAV, inicio" className="publico-marca">
            <Marca compacta />
            <span className="publico-marca-texto"><strong>ZAV</strong><small>Fiambres &amp; embutidos</small></span>
          </Link>

          <nav className="publico-nav" aria-label="Navegación principal">
            <a href="#productos">Productos</a>
            <a href="#promociones">Promociones</a>
            <a href="#novedades">Noticias</a>
            <a href="#zav">Nosotros</a>
          </nav>

          <Link className="publico-acceso" href="/acceso">Acceso interno <Icono nombre="flecha" tamano={15} /></Link>
        </div>
      </header>

      <main id="principal" tabIndex={-1}>
        <section className="publico-hero">
          <Image
            src="/demo/hero-fiambres-demo.webp"
            alt="Composición visual de fiambres y embutidos"
            fill
            priority
            sizes="100vw"
            className="publico-hero-fondo"
          />
          <div className="publico-hero-capa" />
          <div className="contenedor-publico publico-hero-interior">
            <div className="publico-hero-contenido">
              <span className="publico-kicker">FIAMBRES &amp; EMBUTIDOS · TARIJA, BOLIVIA</span>
              <h1>Una nueva forma de presentar <em>ZAV.</em></h1>
              <p>Un sitio público pensado para reunir catálogo, promociones, noticias e información de la empresa con una identidad visual coherente con la marca.</p>
              <div className="publico-hero-acciones">
                <a className="boton boton-primario boton-grande" href="#productos">Ver propuesta <Icono nombre="flecha" tamano={17} /></a>
                <a className="boton boton-inverso boton-grande" href="#zav">Conocer ZAV</a>
              </div>
            </div>

            <div className="publico-hero-franja" aria-label="Secciones futuras del sitio">
              <div><span>01</span><strong>Catálogo</strong><small>Productos y presentaciones</small></div>
              <div><span>02</span><strong>Promociones</strong><small>Campañas y novedades</small></div>
              <div><span>03</span><strong>Noticias</strong><small>Contenido institucional</small></div>
            </div>
          </div>
        </section>

        <section id="productos" className="publico-seccion publico-productos contenedor-publico" aria-labelledby="productos-titulo">
          <header className="publico-seccion-cabecera">
            <div>
              <span className="eyebrow">CATÁLOGO / ESTRUCTURA FUTURA</span>
              <h2 id="productos-titulo">El producto al centro de la experiencia.</h2>
            </div>
            <p>La composición ya queda preparada para mostrar productos reales cuando exista el módulo público. Las imágenes actuales son solo referencia visual del diseño.</p>
          </header>

          <div className="publico-productos-grid">
            {productosReferencia.map((producto, indice) => (
              <article className={indice === 0 ? 'publico-producto publico-producto-principal' : 'publico-producto'} key={producto.titulo}>
                <div className="publico-producto-imagen">
                  <Image src={producto.imagen} alt="Imagen referencial de producto" fill sizes={indice === 0 ? '(max-width: 760px) 100vw, 52vw' : '(max-width: 760px) 100vw, 24vw'} />
                </div>
                <div className="publico-producto-info">
                  <span>{producto.subtitulo}</span>
                  <h3>{producto.titulo}</h3>
                  <span className="publico-producto-enlace">Ver detalle <span aria-hidden="true">↗</span></span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="promociones" className="publico-promo">
          <div className="contenedor-publico publico-promo-grid">
            <div className="publico-promo-imagen">
              <Image src="/demo/productos-demo.webp" alt="Imagen referencial para sección promocional" fill sizes="(max-width: 760px) 100vw, 46vw" />
            </div>
            <div className="publico-promo-contenido">
              <span className="publico-kicker">PROMOCIONES / SECCIÓN FUTURA</span>
              <h2>Las campañas necesitan un espacio propio.</h2>
              <p>La portada reservará una zona de alta visibilidad para promociones vigentes, combos o comunicaciones comerciales sin competir visualmente con el catálogo.</p>
              <span className="publico-promo-accion">Espacio preparado para contenido dinámico <span aria-hidden="true">→</span></span>
            </div>
          </div>
        </section>

        <section id="novedades" className="publico-seccion publico-novedades contenedor-publico" aria-labelledby="novedades-titulo">
          <div className="publico-novedades-editorial">
            <div className="publico-novedades-imagen">
              <Image src="/demo/produccion-demo.webp" alt="Imagen referencial de producción" fill sizes="(max-width: 800px) 100vw, 46vw" />
            </div>
            <div className="publico-novedades-intro">
              <span className="eyebrow">NOTICIAS / INFORMACIÓN</span>
              <h2 id="novedades-titulo">Contenido con jerarquía, no una grilla de tarjetas genéricas.</h2>
              <p>Una noticia principal puede convivir con publicaciones breves y mantener la portada ordenada.</p>
            </div>
          </div>

          <div className="publico-novedades-lista">
            {novedadesReferencia.map((novedad, indice) => (
              <article key={novedad.titulo}>
                <span className="publico-novedad-numero">0{indice + 1}</span>
                <div><time>{novedad.categoria}</time><h3>{novedad.titulo}</h3></div>
                <span className="publico-novedad-flecha" aria-hidden="true">↗</span>
              </article>
            ))}
          </div>
        </section>

        <section id="zav" className="publico-zav">
          <div className="contenedor-publico publico-zav-grid">
            <div className="publico-zav-marca">
              <Marca grande />
            </div>
            <div className="publico-zav-texto">
              <span className="publico-kicker">IDENTIDAD ZAV</span>
              <h2>Un sitio para comunicar. Un sistema para gestionar.</h2>
              <p>La parte pública y el entorno administrativo se mantienen separados. El visitante encuentra información de la empresa; el personal autorizado accede a las herramientas internas desde un punto específico.</p>
              <Link className="publico-link" href="/acceso">Ir al acceso administrativo <Icono nombre="flecha" tamano={16} /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="publico-footer">
        <div className="contenedor-publico publico-footer-interior">
          <div className="publico-footer-marca"><Marca compacta /><span><strong>ZAV</strong><small>Fiambres &amp; embutidos</small></span></div>
          <p>Tarija, Bolivia</p>
          <Link href="/acceso">Acceso interno</Link>
        </div>
      </footer>
    </div>
  );
}

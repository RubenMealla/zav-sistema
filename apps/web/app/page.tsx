import Link from 'next/link';
import { configuracionPublica } from './configuracion-publica';
import { Icono } from './componentes/icono';
import { Marca } from './componentes/marca';

const operaciones = [
  { numero: '01', titulo: 'Productos y lotes', texto: 'Presentaciones, fechas de vencimiento y existencias de productos terminados.' },
  { numero: '02', titulo: 'Condición comercial', texto: 'Liberación y bloqueo de lotes con motivo y responsable.' },
  { numero: '03', titulo: 'Movimientos', texto: 'Ingresos y traslados entre ubicaciones operativas.' },
];

const indiceCatalogo = [
  { numero: '01', titulo: 'Familias', texto: 'Organización de productos por tipo.' },
  { numero: '02', titulo: 'Presentaciones', texto: 'Formatos y datos visibles para el cliente.' },
  { numero: '03', titulo: 'Detalle', texto: 'Información propia de cada producto.' },
];

const novedadesReferencia = [
  { numero: '01', categoria: 'NOVEDADES', titulo: 'Un espacio editorial para comunicar lanzamientos y cambios relevantes.' },
  { numero: '02', categoria: 'INFORMACIÓN', titulo: 'Contenido útil para clientes y visitantes sin mezclarlo con la operación interna.' },
  { numero: '03', categoria: 'MARCA', titulo: 'La identidad de ZAV como parte visible del sitio, no como un bloque genérico.' },
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
            <span className="publico-marca-texto"><strong>ZAV</strong><small>Fiambres &amp; embutidos</small></span>
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
              <span className="publico-kicker">ZAV · FIAMBRES &amp; EMBUTIDOS · TARIJA</span>
              <h1>Una identidad propia para presentar <em>ZAV.</em></h1>
              <p>La presencia pública de la empresa y el acceso al sistema interno se mantienen claramente separados, con una experiencia visual coherente con la marca.</p>
              <div className="publico-hero-acciones">
                {mostrarLandingExtendida ? (
                  <a className="boton boton-primario boton-grande" href="#productos">
                    Conocer la propuesta <Icono nombre="flecha" tamano={17} />
                  </a>
                ) : null}
                <Link className={mostrarLandingExtendida ? 'publico-boton-secundario' : 'boton boton-primario boton-grande'} href="/acceso">
                  Ingresar al sistema <Icono nombre="flecha" tamano={17} />
                </Link>
              </div>
              <span className="publico-nota"><Icono nombre="escudo" tamano={15} /> El entorno administrativo requiere autenticación.</span>
            </div>

            <div className="publico-hero-marca" aria-label="Identidad visual ZAV">
              <span className="publico-hero-marca-etiqueta">FIAMBRES / EMBUTIDOS</span>
              <Marca etiqueta grande />
              <div className="publico-hero-marca-pie"><span>ZAV</span><span>Tarija · Bolivia</span></div>
            </div>
          </div>
        </section>

        {mostrarLandingExtendida ? (
          <>
            <section id="productos" className="publico-seccion publico-catalogo">
              <div className="contenedor-publico">
                <header className="publico-seccion-cabecera">
                  <div>
                    <span className="eyebrow">CATÁLOGO / PRODUCTOS</span>
                    <h2 id="productos-titulo">El producto debe ocupar espacio, no quedar reducido a una tarjeta.</h2>
                  </div>
                  <p>La sección queda preparada para incorporar productos reales cuando exista una fuente pública validada. La estructura prioriza fotografía, presentación y lectura antes que iconos decorativos.</p>
                </header>

                <div className="publico-catalogo-editorial" aria-labelledby="productos-titulo">
                  <article className="publico-catalogo-principal">
                    <div className="publico-catalogo-fondo" aria-hidden="true">
                      <span>ZAV</span>
                      <b>01</b>
                    </div>
                    <div className="publico-catalogo-principal-contenido">
                      <span className="publico-kicker">PRODUCTO DESTACADO</span>
                      <h3>Una composición reservada para una fotografía real de producto.</h3>
                      <p>Cuando el catálogo público esté implementado, este espacio podrá mostrar una presentación concreta sin convertir toda la portada en una cuadrícula repetitiva.</p>
                    </div>
                  </article>

                  <aside className="publico-catalogo-indice" aria-label="Estructura prevista del catálogo">
                    <span className="publico-catalogo-indice-titulo">ESTRUCTURA</span>
                    {indiceCatalogo.map((item) => (
                      <div key={item.numero} className="publico-catalogo-fila">
                        <span>{item.numero}</span>
                        <div><strong>{item.titulo}</strong><p>{item.texto}</p></div>
                      </div>
                    ))}
                  </aside>
                </div>
              </div>
            </section>

            <section id="promociones" className="publico-promo">
              <div className="contenedor-publico publico-promo-grid">
                <div className="publico-promo-numero" aria-hidden="true">02</div>
                <div className="publico-promo-contenido">
                  <span className="publico-kicker">PROMOCIONES</span>
                  <h2>Las campañas necesitan una pausa visual propia.</h2>
                  <p>Este bloque está pensado como una pieza editorial de alto contraste para una promoción vigente, un combo o una comunicación comercial. No comparte el mismo patrón visual del catálogo ni de las noticias.</p>
                  <span className="publico-promo-linea">Contenido dinámico cuando el módulo esté disponible</span>
                </div>
              </div>
            </section>

            <section id="novedades" className="publico-seccion publico-novedades contenedor-publico" aria-labelledby="novedades-titulo">
              <div className="publico-novedades-intro">
                <span className="eyebrow">NOTICIAS / INFORMACIÓN</span>
                <h2 id="novedades-titulo">Una sección de lectura, no otra colección de tarjetas.</h2>
                <p>La jerarquía se apoya en títulos, líneas, numeración y espacio. Cuando existan publicaciones reales, podrán reemplazar estos textos de referencia.</p>
              </div>
              <div className="publico-novedades-lista">
                {novedadesReferencia.map((novedad) => (
                  <article key={novedad.numero}>
                    <span>{novedad.numero}</span>
                    <div><small>{novedad.categoria}</small><h3>{novedad.titulo}</h3></div>
                    <b aria-hidden="true">↗</b>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <section id="zav" className="publico-zav">
          <div className="contenedor-publico publico-zav-grid">
            <div className="publico-zav-marca">
              <span className="publico-zav-rotulo">ZAV / TARIJA</span>
              <Marca grande />
            </div>
            <div className="publico-zav-texto">
              <span className="publico-kicker">NOSOTROS / IDENTIDAD ZAV</span>
              <h2>Una empresa de fiambres y embutidos con una presencia digital propia.</h2>
              <p>ZAV se presenta desde Tarija, Bolivia. La información institucional detallada se incorporará únicamente a partir de datos confirmados de la empresa, evitando publicar historia, cifras o atributos que no hayan sido validados.</p>
              <p>El sitio público está pensado para comunicar productos, promociones, noticias e información de ZAV; el personal autorizado accede al sistema administrativo por una ruta separada.</p>
              <Link className="publico-link" href="/acceso">Ir al acceso administrativo <Icono nombre="flecha" tamano={16} /></Link>
            </div>
          </div>
        </section>

        <section id="sistema" className="publico-operaciones">
          <div className="contenedor-publico">
            <div className="publico-seccion-titulo">
              <span className="eyebrow">SISTEMA INTERNO</span>
              <h2>La operación administrativa permanece fuera del recorrido público.</h2>
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

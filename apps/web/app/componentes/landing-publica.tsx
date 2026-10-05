'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icono } from './icono';
import { Marca } from './marca';

type Familia = {
  id: string;
  nombre: string;
  descripcion: string;
  icono: ReactNode;
  imagen?: string;
  productos: Array<{ nombre: string; imagen: string }>;
};

const familias: Familia[] = [
  {
    id: 'mortadelas',
    nombre: 'Mortadelas',
    descripcion: 'Productos identificados en el material entregado por ZAV.',
    imagen: '/catalogo/mortadelas-mortadela-primavera.webp',
    icono: <><path d="M5 8.5c2.6-2.7 11.4-2.7 14 0v7c-2.6 2.7-11.4 2.7-14 0Z"/><path d="M8 9.5v5M12 8.8v6.4M16 9.5v5"/></>,
    productos: [
      { nombre: 'Mortadela Jamonada', imagen: '/catalogo/mortadelas-mortadela-jamonada.webp' },
      { nombre: 'Mortadela Primavera', imagen: '/catalogo/mortadelas-mortadela-primavera.webp' },
      { nombre: 'Mortadela Tradicional', imagen: '/catalogo/mortadelas-mortadela-tradicional.webp' },
    ],
  },
  {
    id: 'chorizos',
    nombre: 'Chorizos',
    descripcion: 'Productos identificados en el material entregado por ZAV.',
    imagen: '/catalogo/chorizos-chorizo-coctelero.webp',
    icono: <><path d="M7 5c2 2 2 12 0 14M17 5c-2 2-2 12 0 14"/><path d="M7 7c3-1.4 7-1.4 10 0M7 17c3 1.4 7 1.4 10 0"/></>,
    productos: [
      { nombre: 'Chorizo Coctelero', imagen: '/catalogo/chorizos-chorizo-coctelero.webp' },
      { nombre: 'Chorizo Parrillero', imagen: '/catalogo/chorizos-chorizo-parrillero.webp' },
      { nombre: 'Chorizo Precocido', imagen: '/catalogo/chorizos-chorizo-precocido.webp' },
      { nombre: 'Chorizo Tipo Español', imagen: '/catalogo/chorizos-chorizo-tipo-espanol.webp' },
    ],
  },
  {
    id: 'salchichas',
    nombre: 'Salchichas',
    descripcion: 'Productos identificados en el material entregado por ZAV.',
    icono: <><path d="M5 9c0-2 1.6-3.5 3.5-3.5h7C17.4 5.5 19 7 19 9s-1.6 3.5-3.5 3.5h-7C6.6 12.5 5 11 5 9Z"/><path d="M5 15h14M8 12.5V15M16 12.5V15"/></>,
    productos: [
      { nombre: 'Salchicha Tipo Súper Pancho', imagen: '/catalogo/salchichas-salchicha-tipo-super-pancho.webp' },
      { nombre: 'Salchicha Tipo Viena', imagen: '/catalogo/salchichas-salchicha-tipo-viena.webp' },
    ],
  },
  {
    id: 'morcillas',
    nombre: 'Morcillas',
    descripcion: 'Productos identificados en el material entregado por ZAV.',
    icono: <><path d="M7 6.5c3-2 7-2 10 0 2.7 1.8 2.7 9.2 0 11-3 2-7 2-10 0-2.7-1.8-2.7-9.2 0-11Z"/><path d="m8.5 7.5 7 9M15.5 7.5l-7 9"/></>,
    productos: [{ nombre: 'Morcilla Artesanal', imagen: '/catalogo/morcillas-morcilla-artesanal.webp' }],
  },
  {
    id: 'jamones',
    nombre: 'Jamones',
    descripcion: 'Productos identificados en el material entregado por ZAV.',
    icono: <><path d="M6 8c0-2 1.8-3 4-3h5.5A3.5 3.5 0 0 1 19 8.5v7A3.5 3.5 0 0 1 15.5 19H10c-2.2 0-4-1-4-3Z"/><path d="M9 9h7M9 12h7M9 15h5"/></>,
    productos: [{ nombre: 'Jamón Cocido Light', imagen: '/catalogo/jamones-jamon-cocido-light.webp' }],
  },
  {
    id: 'tocinos-ahumados',
    nombre: 'Tocinos y ahumados',
    descripcion: 'Productos identificados en el material entregado por ZAV.',
    icono: <><path d="M5 8c3-2 5 2 8 0s4-1 6 0v8c-2-1-3-2-6 0s-5-2-8 0Z"/><path d="M6 11c2-1 4 1 6 0s4-1 6 0M6 14c2-1 4 1 6 0s4-1 6 0"/></>,
    productos: [{ nombre: 'Tocino Ahumado', imagen: '/catalogo/tocinos-y-ahumados-tocino-ahumado.webp' }],
  },
  {
    id: 'fiambres-especiales',
    nombre: 'Fiambres especiales',
    descripcion: 'Productos identificados en el material entregado por ZAV.',
    icono: <><path d="M12 4 19 8v8l-7 4-7-4V8Z"/><path d="m8 10 4-2 4 2v4l-4 2-4-2Z"/></>,
    productos: [{ nombre: 'Queso de Chancho', imagen: '/catalogo/fiambres-especiales-queso-de-chancho.webp' }],
  },
];

const destacados = [
  { etiqueta: 'PRODUCTO DESTACADO', titulo: 'Mortadela Primavera', texto: 'Imagen de producto incluida en el material real entregado por ZAV.', imagen: '/catalogo/mortadelas-mortadela-primavera.webp' },
  { etiqueta: 'PRODUCTO DESTACADO', titulo: 'Chorizo Coctelero', texto: 'Imagen de producto incluida en el material real entregado por ZAV.', imagen: '/catalogo/chorizos-chorizo-coctelero.webp' },
];

function Pictograma({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function LandingPublica() {
  const [seccionActiva, setSeccionActiva] = useState('novedades');
  const [destacado, setDestacado] = useState(0);
  const [familiaActiva, setFamiliaActiva] = useState(familias[0].id);
  const familia = useMemo(() => familias.find((item) => item.id === familiaActiva) ?? familias[0], [familiaActiva]);

  useEffect(() => {
    const secciones = ['novedades', 'productos', 'zav']
      .map((id) => document.getElementById(id))
      .filter((elemento): elemento is HTMLElement => Boolean(elemento));
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.filter((entrada) => entrada.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setSeccionActiva(visible.target.id);
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0.05, 0.2, 0.45] },
    );
    secciones.forEach((seccion) => observador.observe(seccion));
    return () => observador.disconnect();
  }, []);

  function moverDestacado(delta: number) {
    setDestacado((actual) => (actual + delta + destacados.length) % destacados.length);
  }

  return (
    <div className="sitio-publico">
      <a className="saltar-contenido" href="#principal">Saltar al contenido</a>

      <header className="publico-header">
        <div className="contenedor-publico publico-header-interior">
          <Link href="/" aria-label="ZAV, inicio" className="publico-marca"><Marca compacta /></Link>
          <nav className="publico-nav" aria-label="Navegación principal">
            {[
              ['novedades', 'Noticias'],
              ['productos', 'Productos'],
              ['zav', 'Nosotros'],
            ].map(([id, texto]) => (
              <a key={id} href={'#' + id} className={seccionActiva === id ? 'activo' : ''} aria-current={seccionActiva === id ? 'location' : undefined}>
                {texto}
              </a>
            ))}
          </nav>
          <Link className="publico-acceso" href="/acceso">Acceso interno <Icono nombre="flecha" tamano={15} /></Link>
        </div>
      </header>

      <main id="principal" tabIndex={-1}>
        <section id="novedades" className="publico-hero publico-seccion-ancla">
          <div className="contenedor-publico publico-hero-grid">
            <div className="publico-hero-copy">
              <span className="publico-kicker">TARIJA · BOLIVIA</span>
              <h1>Fiambres y embutidos <em>ZAV.</em></h1>
              <p>Productos, novedades y la identidad de ZAV en un espacio público claro y directo.</p>
              <a className="publico-link-hero" href="#productos">Ver productos <Icono nombre="flecha" tamano={16} /></a>
            </div>

            <div className="publico-noticia" aria-roledescription="carrusel" aria-label="Contenido destacado de ZAV">
              <div className="publico-noticia-imagen">
                <Image key={destacados[destacado].imagen} src={destacados[destacado].imagen} alt={destacados[destacado].titulo} fill priority sizes="(max-width: 900px) 100vw, 52vw" />
              </div>
              <div className="publico-noticia-contenido" aria-live="polite">
                <div>
                  <span>{destacados[destacado].etiqueta}</span>
                  <h2>{destacados[destacado].titulo}</h2>
                  <p>{destacados[destacado].texto}</p>
                </div>
                <div className="publico-noticia-controles">
                  <button type="button" onClick={() => moverDestacado(-1)} aria-label="Contenido anterior">←</button>
                  <div className="publico-noticia-puntos" aria-label="Seleccionar contenido destacado">
                    {destacados.map((item, indice) => (
                      <button type="button" key={item.titulo} className={indice === destacado ? 'activo' : ''} aria-label={'Ver destacado ' + (indice + 1) + ': ' + item.titulo} aria-pressed={indice === destacado} onClick={() => setDestacado(indice)} />
                    ))}
                  </div>
                  <button type="button" onClick={() => moverDestacado(1)} aria-label="Contenido siguiente">→</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="productos" className="publico-productos publico-seccion-ancla">
          <div className="contenedor-publico">
            <header className="publico-seccion-intro publico-productos-intro">
              <span className="eyebrow">PRODUCTOS</span>
              <h2>Siete familias. Una identidad.</h2>
              <p>Selecciona una familia para explorar el material fotográfico entregado por ZAV.</p>
            </header>

            <div className="familias-grid" role="group" aria-label="Familias de productos">
              {familias.map((item) => (
                <button type="button" key={item.id} className={familiaActiva === item.id ? 'familia-card activa' : 'familia-card'} aria-pressed={familiaActiva === item.id} onClick={() => setFamiliaActiva(item.id)}>
                  <span className="familia-icono"><Pictograma>{item.icono}</Pictograma></span>
                  <span>{item.nombre}</span>
                </button>
              ))}
            </div>

            <div className="catalogo-familia" aria-live="polite">
              <div className="catalogo-familia-cabecera">
                <div>
                  <span className="eyebrow">{familia.nombre.toUpperCase()}</span>
                  <h3>{familia.nombre}</h3>
                  <p>{familia.descripcion}</p>
                </div>
                <span className="catalogo-conteo">{familia.productos.length.toString().padStart(2, '0')} productos</span>
              </div>
              <div className="productos-grid">
                {familia.productos.map((producto) => (
                  <article className="producto-publico" key={producto.nombre}>
                    <div className="producto-publico-imagen">
                      <Image src={producto.imagen} alt={producto.nombre} fill sizes="(max-width: 640px) 78vw, (max-width: 980px) 40vw, 24vw" />
                    </div>
                    <div className="producto-publico-pie">
                      <span>{familia.nombre}</span>
                      <h4>{producto.nombre}</h4>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="zav" className="publico-zav publico-seccion-ancla">
          <div className="contenedor-publico publico-zav-grid">
            <div className="publico-zav-marca"><Marca grande /></div>
            <div className="publico-zav-copy">
              <span className="eyebrow">NOSOTROS</span>
              <h2>ZAV · Fiambres &amp; Embutidos.</h2>
              <p>Tarija, Bolivia.</p>
              <p>La información institucional ampliada se incorporará únicamente con datos confirmados por la empresa.</p>
              <Link className="publico-link" href="/acceso">Acceso al sistema interno <Icono nombre="flecha" tamano={16} /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="publico-footer">
        <div className="contenedor-publico publico-footer-grid">
          <div className="publico-footer-identidad"><Marca compacta /><p>Fiambres &amp; Embutidos · Tarija, Bolivia</p></div>
          <nav aria-label="Navegación del pie"><a href="#novedades">Noticias</a><a href="#productos">Productos</a><a href="#zav">Nosotros</a><Link href="/acceso">Acceso interno</Link></nav>
          <div className="publico-footer-redes" aria-label="Redes sociales de ZAV"><span>Facebook</span><span>Instagram</span><span>WhatsApp</span><span>TikTok</span></div>
        </div>
        <div className="contenedor-publico publico-footer-legal"><span>ZAV · Fiambres &amp; Embutidos</span><span>© 2026</span></div>
      </footer>
    </div>
  );
}

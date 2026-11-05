"use client";
import Link from "next/link";
import Image from "next/image";
import { FamiliaIcono } from "./familia-icono";
import { IlustracionMesa } from "./ilustracion-mesa";
import { useEffect, useMemo, useState } from "react";
import { Icono } from "./icono";
import { Marca } from "./marca";
import { VERSION_WEB } from "../lib/version";

import type { FamiliaPublica } from "../lib/catalogo-publico";

function FotoCatalogo({
  nombre,
  imagen,
  destacada = false,
}: {
  nombre: string;
  imagen: string | null;
  destacada?: boolean;
}) {
  if (!imagen)
    return <span className="texto-secundario">Fotografía pendiente</span>;
  return (
    <Image
      className={
        destacada
          ? "foto-original foto-original-destacada"
          : "foto-original foto-original-producto"
      }
      src={imagen}
      alt={nombre}
      width={720}
      height={540}
      sizes={
        destacada
          ? "(max-width: 680px) 90vw, (max-width: 1100px) 70vw, 600px"
          : "(max-width: 680px) 90vw, (max-width: 1100px) 45vw, 360px"
      }
      unoptimized={imagen.startsWith("/api/")}
      fetchPriority={destacada ? "high" : "auto"}
      loading={destacada ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

export function LandingPublica({
  catalogo,
  errorCatalogo = false,
}: {
  catalogo: FamiliaPublica[];
  errorCatalogo?: boolean;
}) {
  const familias = catalogo;
  const destacados = familias
    .flatMap((f) =>
      f.productos.map((p) => ({
        etiqueta: f.nombre,
        titulo: p.nombre,
        texto: p.descripcion || f.descripcion,
        imagen: p.imagen,
      })),
    )
    .slice(0, 5);
  const totalProductos = familias.reduce((s, f) => s + f.productos.length, 0);
  const [seccionActiva, setSeccionActiva] = useState("novedades");
  const [destacado, setDestacado] = useState(0);
  const [familiaActiva, setFamiliaActiva] = useState(familias[0]?.id ?? "");
  const familia = useMemo(
    () =>
      familias.find((x) => x.id === familiaActiva) ??
      familias[0] ?? {
        nombre: "Catálogo",
        descripcion: "No hay productos publicados en este momento.",
        productos: [],
      },
    [familiaActiva, familias],
  );
  useEffect(() => {
    const secciones = ["novedades", "productos", "zav"]
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => Boolean(e));
    let observador: IntersectionObserver;
    const observar = () => {
      observador?.disconnect();
      const visibles = new Map<string, number>();
      // Los porcentajes de rootMargin se calculan sobre el ancho, incluso los verticales.
      const alto = window.innerHeight;
      observador = new IntersectionObserver(
        (entradas) => {
          for (const entrada of entradas) {
            if (entrada.isIntersecting)
              visibles.set(entrada.target.id, entrada.intersectionRatio);
            else visibles.delete(entrada.target.id);
          }
          const activa = [...visibles].sort((a, b) => b[1] - a[1])[0];
          if (activa) setSeccionActiva(activa[0]);
        },
        {
          rootMargin: `-${Math.round(alto * 0.25)}px 0px -${Math.round(alto * 0.55)}px 0px`,
          threshold: [0, 0.05, 0.2, 0.45],
        },
      );
      secciones.forEach((seccion) => observador.observe(seccion));
    };
    observar();
    window.addEventListener("resize", observar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", observar);
    };
  }, []);
  const mover = (d: number) =>
    setDestacado((a) => (a + d + destacados.length) % destacados.length);
  return (
    <div className="sitio-publico">
      <a className="saltar-contenido" href="#principal">
        Saltar al contenido
      </a>
      <header className="publico-header">
        <div className="contenedor-publico publico-header-interior">
          <Link href="/" aria-label="ZAV, inicio" className="publico-marca">
            <Marca compacta />
          </Link>
          <nav className="publico-nav" aria-label="Navegación principal">
            {[
              ["novedades", "Noticias"],
              ["productos", "Productos"],
              ["zav", "Nosotros"],
            ].map(([id, t]) => (
              <a
                key={id}
                href={"#" + id}
                className={seccionActiva === id ? "activo" : ""}
                aria-current={seccionActiva === id ? "location" : undefined}
              >
                {t}
              </a>
            ))}
          </nav>
          <Link className="publico-acceso" href="/acceso">
            Acceso interno <Icono nombre="flecha" tamano={15} />
          </Link>
        </div>
      </header>
      <main id="principal" tabIndex={-1}>
        <section id="novedades" className="publico-hero publico-seccion-ancla">
          <div className="contenedor-publico publico-hero-grid">
            <div className="publico-hero-copy">
              <span className="publico-kicker">TARIJA · BOLIVIA</span>
              <h1>
                Fiambres y embutidos <em>ZAV.</em>
              </h1>
              <p>De Tarija a tu mesa. Conoce nuestros fiambres y embutidos.</p>
              <a className="publico-link-hero" href="#productos">
                Explorar catálogo <Icono nombre="flecha" tamano={16} />
              </a>
            </div>
            {destacados.length > 0 && (
              <div
                className="publico-noticia"
                aria-roledescription="carrusel"
                aria-label="Contenido destacado de ZAV"
              >
                <div className="publico-noticia-imagen">
                  <FotoCatalogo
                    key={destacados[destacado].imagen}
                    nombre={destacados[destacado].titulo}
                    imagen={destacados[destacado].imagen}
                    destacada
                  />
                </div>
                <div className="publico-noticia-contenido" aria-live="polite">
                  <div>
                    <span>{destacados[destacado].etiqueta}</span>
                    <h2>{destacados[destacado].titulo}</h2>
                    <p>{destacados[destacado].texto}</p>
                  </div>
                  <div className="publico-noticia-controles">
                    <button
                      type="button"
                      onClick={() => mover(-1)}
                      aria-label="Contenido anterior"
                    >
                      ←
                    </button>
                    <div className="publico-noticia-puntos">
                      {destacados.map((x, i) => (
                        <button
                          type="button"
                          key={x.titulo}
                          className={i === destacado ? "activo" : ""}
                          onClick={() => setDestacado(i)}
                          aria-label={"Ver " + x.titulo}
                          aria-pressed={i === destacado}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => mover(1)}
                      aria-label="Contenido siguiente"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
        <section
          id="productos"
          className="publico-productos publico-seccion-ancla"
        >
          <div className="contenedor-publico">
            <header className="publico-seccion-intro publico-productos-intro">
              <div>
                <span className="eyebrow">PRODUCTOS</span>
                <h2>{familias.length} familias de productos ZAV.</h2>
              </div>
              <p>Encuentra tus favoritos por familia.</p>
            </header>
            {errorCatalogo && (
              <p role="status">
                El catálogo no está disponible temporalmente. Vuelve a cargar la
                página en unos instantes.
              </p>
            )}
            <div
              className="familias-grid"
              role="group"
              aria-label="Familias de productos"
            >
              {familias.map((x) => (
                <button
                  type="button"
                  key={x.id}
                  className={
                    familiaActiva === x.id
                      ? "familia-card activa"
                      : "familia-card"
                  }
                  aria-pressed={familiaActiva === x.id}
                  onClick={() => setFamiliaActiva(x.id)}
                >
                  <span className="familia-icono">
                    {x.imagen?.startsWith("/api/") ? (
                      <Image
                        src={x.imagen}
                        alt=""
                        width={64}
                        height={48}
                        unoptimized
                      />
                    ) : (
                      <FamiliaIcono nombre={x.nombre} />
                    )}
                  </span>
                  <span>{x.nombre}</span>
                </button>
              ))}
            </div>
            <div className="catalogo-familia" aria-live="polite">
              <div className="catalogo-familia-cabecera">
                <div>
                  <span className="eyebrow">
                    {familia.nombre.toUpperCase()}
                  </span>
                  <h3>{familia.nombre}</h3>
                  <p>{familia.descripcion}</p>
                </div>
                <span className="catalogo-conteo">
                  {familia.productos.length.toString().padStart(2, "0")}{" "}
                  productos
                </span>
              </div>
              <div className="productos-grid">
                {familia.productos.map((p) => (
                  <article className="producto-publico" key={p.nombre}>
                    <div className="producto-publico-imagen">
                      <FotoCatalogo nombre={p.nombre} imagen={p.imagen} />
                    </div>
                    <div className="producto-publico-pie">
                      <span>{familia.nombre}</span>
                      <h4>{p.nombre}</h4>
                      {p.descripcion && <p>{p.descripcion}</p>}
                      {p.caracteristicas && <small>{p.caracteristicas}</small>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section id="zav" className="publico-zav publico-seccion-ancla">
          <div className="contenedor-publico publico-zav-grid">
            <div className="publico-zav-escena">
              <IlustracionMesa />
              <span className="publico-zav-lugar">TARIJA · BOLIVIA</span>
            </div>
            <div className="publico-zav-copy">
              <span className="eyebrow">SOMOS ZAV</span>
              <h2>
                De aquí.
                <br />
                Para compartir.
              </h2>
              <p>
                Somos Fiambres y Embutidos ZAV, de Tarija. Nuestro catálogo
                reúne mortadelas, chorizos, salchichas y otros sabores que
                puedes conocer aquí, producto por producto.
              </p>
              <p>
                ¿Parrillero, Primavera o Viena? Cada uno tiene su lugar en la
                mesa. Mira las familias y encuentra el que buscas.
              </p>
              <a className="publico-link" href="#productos">
                Conocer los productos <Icono nombre="flecha" tamano={16} />
              </a>
              <div className="publico-zav-firma">
                <span>{familias.length} familias</span>
                <span>{totalProductos} productos</span>
                <span>Una marca tarijeña</span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="publico-footer">
        <div className="contenedor-publico publico-footer-grid">
          <div className="publico-footer-identidad">
            <Marca compacta />
            <p>Catálogo público de Fiambres y Embutidos ZAV.</p>
            <p>Tarija, Bolivia.</p>
          </div>
          <nav aria-label="Navegación del pie">
            <h3>Explorar</h3>
            <a href="#novedades">Noticias</a>
            <a href="#productos">Productos</a>
            <a href="#zav">Nosotros</a>
          </nav>
          <div className="publico-footer-col">
            <h3>Catálogo</h3>
            <a href="#productos">{familias.length} familias de productos</a>
            <span>{totalProductos} productos publicados</span>
            <a href="#productos">Ver productos</a>
          </div>
          <div className="publico-footer-col">
            <h3>Información</h3>
            <div className="publico-footer-redes">
              <a
                href="https://facebook.com/863449187010368"
                target="_blank"
                rel="noreferrer"
              >
                Facebook
              </a>
              <a
                href="https://minsalud.gob.bo/8175-salud-autoriza-a-42-empresas-para-la-venta-de-salchichas-a-nivel-nacional-que-cumplen-con-estandares-de-calidad-exigidos"
                target="_blank"
                rel="noreferrer"
              >
                Ministerio de Salud · 2024
              </a>
              <span>Tarija, Bolivia</span>
            </div>
            <Link className="publico-link" href="/acceso">
              Acceso interno
            </Link>
          </div>
        </div>
        <div className="contenedor-publico publico-footer-legal">
          <span>ZAV · Fiambres &amp; Embutidos</span>
          <span>
            Sitio público · Sistema interno separado · © 2026 · Versión web{" "}
            {VERSION_WEB}
          </span>
        </div>
      </footer>
    </div>
  );
}

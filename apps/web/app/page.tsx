import { Marca } from './componentes/marca';
import Link from 'next/link';
import { Icono } from './componentes/icono';

const capacidades = [
  {
    icono: 'producto' as const,
    titulo: 'Inventario centralizado',
    texto: 'Productos terminados, lotes y existencias organizados en un solo lugar.',
  },
  {
    icono: 'ubicacion' as const,
    titulo: 'Control por ubicación',
    texto: 'Seguimiento de cantidades entre Producción y Almacenamiento y Venta y Despacho.',
  },
  {
    icono: 'historial' as const,
    titulo: 'Trazabilidad',
    texto: 'Movimientos y cambios de condición conservan fecha, responsable y motivo.',
  },
];

export default function Inicio() {
  return (
    <div className="sitio-publico">
      <header className="publico-header contenedor-publico">
        <Link className="logo" href="/" aria-label="ZAV, inicio">
          <Marca />
        </Link>
        <div className="publico-acciones">
          <span className="estado-sistema"><span /> Sistema administrativo</span>
          <Link className="boton boton-primario" href="/acceso">
            Acceso privado <Icono nombre="flecha" tamano={16} />
          </Link>
        </div>
      </header>

      <main>
        <section className="hero contenedor-publico">
          <div className="hero-contenido">
            <span className="eyebrow">ZAV · TARIJA · 2026</span>
            <h1>Control de inventario con trazabilidad clara y decisiones seguras.</h1>
            <p>
              Plataforma administrativa para organizar productos terminados, lotes, existencias,
              movimientos y condición comercial sin mezclar los procesos.
            </p>
            <div className="hero-acciones">
              <Link className="boton boton-primario boton-grande" href="/acceso">
                Ingresar al sistema <Icono nombre="flecha" />
              </Link>
              <span className="hero-nota"><Icono nombre="escudo" tamano={16} /> Acceso exclusivo para personal autorizado</span>
            </div>
          </div>

          <div className="hero-demo" aria-label="Resumen conceptual del sistema">
            <div className="demo-barra">
              <div className="demo-puntos"><span /><span /><span /></div>
              <span>Panel administrativo</span>
              <span className="demo-en-linea">● Operativo</span>
            </div>
            <div className="demo-cuerpo">
              <aside className="demo-lateral">
                <span className="demo-logo">Z</span>
                <span className="activo" />
                <span />
                <span />
                <span />
              </aside>
              <div className="demo-principal">
                <div className="demo-titulo"><span /><span /></div>
                <div className="demo-metricas"><span /><span /><span /></div>
                <div className="demo-tabla">
                  <div className="demo-fila demo-encabezado"><span /><span /><span /><span /></div>
                  <div className="demo-fila"><span /><span /><span /><span className="chip-verde" /></div>
                  <div className="demo-fila"><span /><span /><span /><span className="chip-ambar" /></div>
                  <div className="demo-fila"><span /><span /><span /><span className="chip-verde" /></div>
                </div>
              </div>
            </div>
            <div className="demo-etiqueta"><Icono nombre="check" tamano={15} /> Flujo organizado por módulos</div>
          </div>
        </section>

        <section className="capacidades contenedor-publico">
          <div className="seccion-titulo-publica">
            <span className="eyebrow">CONTROL OPERATIVO</span>
            <h2>La información importante, sin perder el contexto.</h2>
          </div>
          <div className="capacidades-grid">
            {capacidades.map((capacidad) => (
              <article className="capacidad" key={capacidad.titulo}>
                <span className="capacidad-icono"><Icono nombre={capacidad.icono} /></span>
                <h3>{capacidad.titulo}</h3>
                <p>{capacidad.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="publico-cta contenedor-publico">
          <div>
            <span className="eyebrow">ENTORNO ADMINISTRATIVO</span>
            <h2>Un sistema pensado para trabajar rápido y dejar evidencia de cada operación.</h2>
          </div>
          <Link className="boton boton-claro boton-grande" href="/acceso">
            Abrir acceso <Icono nombre="flecha" />
          </Link>
        </section>
      </main>

      <footer className="publico-footer contenedor-publico">
        <span>ZAV · Sistema de gestión de productos terminados</span>
        <span>Trabajo Final · UAJMS · 2026</span>
      </footer>
    </div>
  );
}

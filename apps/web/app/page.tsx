import Link from 'next/link';
import { Marca } from './componentes/marca';
import { Icono } from './componentes/icono';

const operaciones = [
  { numero: '01', titulo: 'Productos y lotes', texto: 'Presentaciones, fechas de vencimiento y existencias de productos terminados.' },
  { numero: '02', titulo: 'Condición comercial', texto: 'Liberación y bloqueo de lotes, con el motivo y el responsable de cada decisión.' },
  { numero: '03', titulo: 'Movimientos', texto: 'Ingresos y traslados entre Producción y Almacenamiento y Venta y Despacho.' },
];

export default function Inicio() {
  return (
    <div className="sitio-publico">
      <a className="saltar-contenido" href="#principal">Saltar al contenido</a>
      <header className="publico-header contenedor-publico">
        <Link href="/" aria-label="ZAV, inicio"><Marca /></Link>
        <span className="publico-descriptor">Fiambres &amp; embutidos <span>Tarija · Bolivia</span></span>
        <Link className="boton boton-secundario" href="/acceso">Acceso privado <Icono nombre="flecha" tamano={16} /></Link>
      </header>
      <main id="principal" tabIndex={-1}>
        <section className="publico-portada contenedor-publico">
          <div className="publico-editorial">
            <span className="eyebrow">ZAV / SISTEMA DE GESTIÓN</span>
            <h1>Fiambres y embutidos.<br /><em>Control en cada lote.</em></h1>
            <p>La información de nuestros productos terminados, desde el ingreso al inventario hasta su traslado entre ubicaciones.</p>
            <Link className="boton boton-primario boton-grande" href="/acceso">Ingresar al sistema <Icono nombre="flecha" /></Link>
            <span className="publico-nota"><Icono nombre="escudo" tamano={16} /> Uso exclusivo del personal autorizado</span>
          </div>
          <figure className="publico-etiqueta">
            <span className="etiqueta-sobretitulo">NUESTRA IDENTIDAD</span>
            <Marca etiqueta grande />
            <figcaption><span>Fiambres &amp; embutidos</span><span>Tarija, Bolivia</span></figcaption>
          </figure>
        </section>
        <section className="publico-operaciones contenedor-publico" aria-labelledby="operaciones-titulo">
          <div className="publico-seccion-titulo"><span className="eyebrow">CONTROL INTERNO</span><h2 id="operaciones-titulo">Cada registro tiene su lugar.</h2></div>
          <div className="publico-registros">
            {operaciones.map((operacion) => (
              <article key={operacion.numero}>
                <span className="publico-numero">{operacion.numero}</span>
                <h3>{operacion.titulo}</h3>
                <p>{operacion.texto}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="publico-footer contenedor-publico"><span>ZAV · Gestión de productos terminados</span><span>Tarija, Bolivia · 2026</span></footer>
    </div>
  );
}

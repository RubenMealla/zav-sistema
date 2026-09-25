import Link from 'next/link';

export default function Inicio() {
  return (
    <div className="landing">
      <header className="barra contenedor">
        <Link className="marca" href="/" aria-label="ZAV, inicio"><span className="marca-simbolo">Z</span><span>ZAV <small>Fiambres y embutidos</small></span></Link>
        <nav aria-label="Navegación principal"><Link className="boton boton-oscuro" href="/acceso">Acceso al sistema →</Link></nav>
      </header>
      <main className="contenedor portada">
        <div className="portada-texto"><span className="etiqueta">ZAV · Tarija, Bolivia</span>
          <h1>Control organizado de productos, lotes y existencias.</h1>
          <p>Acceso al sistema de gestión de productos terminados y sus movimientos. La consulta pública del catálogo, pedidos y distribución se incorporará en las próximas etapas.</p>
          <Link className="boton boton-oscuro" href="/acceso">Ingresar como Administrador <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="portada-panel" aria-label="Vista conceptual de los procesos"><div className="panel-top"><span className="punto"/> Gestión centralizada <span>2026</span></div>
          <div className="tarjeta-flujo"><span className="numero">01</span><div><strong>Productos terminados</strong><p>Registro y consulta de presentaciones comerciales.</p></div></div>
          <div className="tarjeta-flujo"><span className="numero">02</span><div><strong>Lotes y existencias</strong><p>Ingreso inicial y control de cantidades por ubicación.</p></div></div>
          <div className="tarjeta-flujo"><span className="numero">03</span><div><strong>Distribución</strong><p>Etapa funcional pendiente de implementación.</p></div></div>
        </div>
      </main>
      <footer className="pie contenedor">ZAV · Sistema en desarrollo académico · Universidad Autónoma Juan Misael Saracho · 2026</footer>
    </div>
  );
}

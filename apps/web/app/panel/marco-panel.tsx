import Link from 'next/link';
import type { ReactNode } from 'react';
import { cerrarSesion } from '../acciones';
import { Icono } from '../componentes/icono';
import { Marca } from '../componentes/marca';

export type Vista = 'resumen' | 'productos' | 'lotes' | 'condiciones' | 'movimientos' | 'pedidos';
type VistaConfig = { titulo: string; descripcion: string; icono: 'inicio' | 'producto' | 'lote' | 'condicion' | 'movimiento' };
export const vistas: Record<Vista, VistaConfig> = {
  resumen: { titulo: 'Resumen general', descripcion: 'Estado actual del inventario y accesos principales.', icono: 'inicio' },
  productos: { titulo: 'Productos terminados', descripcion: 'Presentaciones comerciales registradas en el sistema.', icono: 'producto' },
  lotes: { titulo: 'Lotes y existencias', descripcion: 'Existencia física, vencimientos y ubicación de cada lote.', icono: 'lote' },
  condiciones: { titulo: 'Condición de lotes', descripcion: 'Liberación, bloqueo y registro de decisiones comerciales.', icono: 'condicion' },
  movimientos: { titulo: 'Movimientos', descripcion: 'Traslados entre ubicaciones e historial de inventario.', icono: 'movimiento' },
  pedidos: { titulo: 'Pedidos', descripcion: 'Auditoría de pedidos y vendedor responsable.', icono: 'movimiento' },
};

export function MarcoPanel({ vista, perfil, children }: {
  vista: Vista;
  perfil: { nombre: string; identificador: string };
  children: ReactNode;
}) {
  const inicial = perfil.nombre?.trim().charAt(0).toUpperCase() || 'A';
  const enlaces = (Object.entries(vistas) as Array<[Vista, VistaConfig]>).map(([clave, item]) => (
    <Link key={clave} href={`/panel?vista=${clave}`} className={vista === clave ? 'nav-item nav-item-activo' : 'nav-item'} aria-current={vista === clave ? 'page' : undefined}>
      <span className="nav-icono"><Icono nombre={item.icono} tamano={17} /></span><span>{item.titulo}</span>
    </Link>
  ));

  return (
    <div className="app-shell">
      <a className="saltar-contenido" href="#contenido-panel">Saltar al contenido</a>

      <aside className="sidebar">
        <div className="sidebar-marca-bloque">
          <Link href="/" aria-label="ZAV, inicio" className="marca-sidebar"><Marca compacta /></Link>
          <div className="sidebar-marca-texto"><strong>ZAV</strong><span>Gestión interna</span></div>
        </div>

        <nav className="sidebar-nav" aria-label="Módulos del sistema">
          <span className="sidebar-seccion">OPERACIÓN</span>
          {enlaces}
        </nav>

        <div className="sidebar-pie">
          <span className="sidebar-entorno">ADMINISTRACIÓN</span>
          <div className="perfil-mini">
            <span className="avatar" aria-hidden="true">{inicial}</span>
            <div><strong>{perfil.nombre}</strong><span>{perfil.identificador}</span></div>
          </div>
          <form action={cerrarSesion}><button type="submit" className="boton-cerrar-sesion">Cerrar sesión <span aria-hidden="true">↗</span></button></form>
        </div>
      </aside>

      <div className="contenido">
        <div className="cabecera-movil">
          <Link href="/" aria-label="ZAV, inicio" className="cabecera-movil-marca"><Marca compacta /><strong>ZAV</strong></Link>
          <form action={cerrarSesion}><button type="submit" className="boton-cerrar-sesion">Salir <span aria-hidden="true">↗</span></button></form>
        </div>

        <header className="topbar">
          <div className="topbar-titulo">
            <div className="breadcrumb"><span>ZAV</span><span aria-hidden="true">/</span><strong>{vistas[vista].titulo}</strong></div>
            <h1>{vistas[vista].titulo}</h1>
            <p>{vistas[vista].descripcion}</p>
          </div>
          <div className="topbar-perfil">
            <span className="topbar-avatar" aria-hidden="true">{inicial}</span>
            <div><strong>{perfil.nombre}</strong><span>Administrador</span></div>
          </div>
        </header>

        <nav className="nav-movil" aria-label="Módulos">{enlaces}</nav>
        <main id="contenido-panel" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}

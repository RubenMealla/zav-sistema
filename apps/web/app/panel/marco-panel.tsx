import Link from 'next/link';
import type { ReactNode } from 'react';
import { cerrarSesion } from '../acciones';
import { Icono } from '../componentes/icono';
import { Marca } from '../componentes/marca';

export type Vista = 'resumen' | 'productos' | 'lotes' | 'condiciones' | 'movimientos' | 'pedidos' | 'distribucion';
type VistaConfig = { titulo: string; descripcion: string; icono: 'inicio' | 'producto' | 'lote' | 'condicion' | 'movimiento' | 'ubicacion' };
export const vistas: Record<Vista, VistaConfig> = {
  resumen: { titulo: 'Resumen', descripcion: 'Inventario, condición y configuración operativa.', icono: 'inicio' },
  productos: { titulo: 'Productos', descripcion: 'Presentaciones comerciales registradas.', icono: 'producto' },
  lotes: { titulo: 'Lotes', descripcion: 'Existencias, condición y vencimientos.', icono: 'lote' },
  condiciones: { titulo: 'Condiciones', descripcion: 'Liberación, bloqueo y auditoría.', icono: 'condicion' },
  movimientos: { titulo: 'Movimientos', descripcion: 'Traslados e historial de inventario.', icono: 'movimiento' },
  pedidos: { titulo: 'Pedidos', descripcion: 'Auditoría de pedidos y responsables.', icono: 'movimiento' },
  distribucion: { titulo: 'Distribución', descripcion: 'Ubicación de salida usada para organizar los repartos.', icono: 'ubicacion' },
};

export function MarcoPanel({ vista, perfil, children }: {
  vista: Vista;
  perfil: { nombre: string; identificador: string };
  children: ReactNode;
}) {
  const inicial = perfil.nombre?.trim().charAt(0).toUpperCase() || 'A';

  const enlaces = (Object.entries(vistas) as Array<[Vista, VistaConfig]>).map(([clave, item]) => (
    <Link
      key={clave}
      href={`/panel?vista=${clave}`}
      className={vista === clave ? 'nav-item nav-item-activo' : 'nav-item'}
      aria-current={vista === clave ? 'page' : undefined}
    >
      <span className="nav-icono"><Icono nombre={item.icono} tamano={16} /></span>
      <span>{item.titulo}</span>
    </Link>
  ));

  return (
    <div className="app-shell">
      <a className="saltar-contenido" href="#contenido-panel">Saltar al contenido</a>

      <aside className="sidebar">
        <Link href="/" aria-label="ZAV, inicio" className="sidebar-marca">
          <Marca compacta />
          <span><strong>ZAV</strong><small>Gestión</small></span>
        </Link>

        <nav className="sidebar-nav" aria-label="Módulos del sistema">
          <span className="sidebar-seccion">ADMINISTRACIÓN</span>
          {enlaces}
        </nav>

        <div className="sidebar-pie">
          <div className="perfil-mini">
            <span className="avatar" aria-hidden="true">{inicial}</span>
            <div><strong>{perfil.nombre}</strong><span>{perfil.identificador}</span></div>
          </div>
          <form action={cerrarSesion}>
            <button type="submit" className="boton-cerrar-sesion">Cerrar sesión <span aria-hidden="true">↗</span></button>
          </form>
        </div>
      </aside>

      <div className="contenido">
        <div className="cabecera-movil">
          <Link href="/" aria-label="ZAV, inicio" className="cabecera-movil-marca"><Marca compacta /><strong>ZAV</strong></Link>
          <form action={cerrarSesion}><button type="submit" className="boton-cerrar-sesion">Salir <span aria-hidden="true">↗</span></button></form>
        </div>

        <header className="topbar">
          <div className="topbar-titulo">
            <div className="breadcrumb"><span>Panel</span><span aria-hidden="true">/</span><strong>{vistas[vista].titulo}</strong></div>
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

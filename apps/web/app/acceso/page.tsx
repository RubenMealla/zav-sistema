import Link from 'next/link';
import { iniciarSesion } from '../acciones';
import { BotonEnviar, CampoContrasena, Notificacion } from '../componentes/interacciones';
import { Icono } from '../componentes/icono';
import { Marca } from '../componentes/marca';

const errores:Record<string,string>={datos:'Completa el identificador y la contraseña.',credenciales:'No fue posible iniciar sesión. Verifica los datos de acceso.',permisos:'Esta pantalla está disponible para el Administrador.',conexion:'No se pudo conectar con el servicio de ZAV.',sesion:'La sesión terminó o ya no es válida. Vuelve a ingresar.'};

function etiquetaCodigo(codigo?: string) {
 if (!codigo) return '';
 if (/^\d{3}$/.test(codigo)) return `HTTP ${codigo}`;
 if (codigo === 'VALIDACION') return 'VALIDACIÓN';
 if (codigo === 'RED') return 'SIN RESPUESTA HTTP';
 if (codigo === 'RESPUESTA_INVALIDA') return 'RESPUESTA INVÁLIDA';
 return codigo;
}

export default async function Acceso({searchParams}:{searchParams:Promise<{error?:string;mensaje?:string;codigo?:string}>}) {
 const {error,mensaje,codigo}=await searchParams;
 return <main className="acceso-layout">
  <section className="acceso-identidad" aria-label="ZAV, acceso interno">
   <div className="acceso-identidad-cabecera"><Link href="/" aria-label="ZAV, inicio" className="acceso-identidad-marca"><Marca compacta/></Link><span>GESTIÓN INTERNA</span></div>
   <div className="acceso-identidad-centro"><div className="acceso-emblema"><Marca grande soloSimbolo/></div><div className="acceso-identidad-copy"><span>ADMINISTRACIÓN</span><h2>Gestión interna clara y segura.</h2><p>Inventario, trazabilidad, pedidos y distribución en un entorno reservado para el personal autorizado.</p></div></div>
   <div className="acceso-identidad-pie"><span>Tarija · Bolivia</span><span>Personal autorizado</span></div>
  </section>
  <section className="acceso-panel" aria-labelledby="acceso-titulo">
   <div className="acceso-panel-superior"><Link href="/" className="volver"><span aria-hidden="true">←</span> Volver al sitio público</Link></div>
   <div className="acceso-formulario-caja">{mensaje==='sesion-cerrada'&&<Notificacion tipo="exito" mensaje="Sesión cerrada correctamente."/>}<Link href="/" aria-label="ZAV, inicio" className="acceso-marca-movil"><Marca compacta/></Link><div className="acceso-titulo"><span className="eyebrow">SISTEMA ADMINISTRATIVO</span><h1 id="acceso-titulo">Iniciar sesión</h1><p>Ingresa con tu cuenta de Administrador para continuar.</p></div>
    {error&&<div role="alert" className="mensaje-inline mensaje-error"><Icono nombre="alerta" tamano={18}/>{codigo&&<span className="mensaje-codigo">{etiquetaCodigo(codigo)}</span>}<p>{errores[error]??'No fue posible completar la solicitud.'}</p></div>}
    <form action={iniciarSesion} className="formulario acceso-formulario"><label className="campo" htmlFor="identificador"><span>Identificador</span><input id="identificador" name="identificador" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={120} required placeholder="Correo o identificador"/></label><CampoContrasena/><BotonEnviar className="boton boton-primario boton-completo" pendiente="Ingresando…">Ingresar al sistema <Icono nombre="flecha" tamano={16}/></BotonEnviar></form>
    <div className="acceso-seguridad"><Icono nombre="escudo" tamano={18}/><div><strong>Acceso restringido</strong><p>Las operaciones quedan asociadas al usuario autenticado.</p></div></div>
   </div>
   <p className="acceso-panel-pie">ZAV · Sistema de gestión · 2026</p>
  </section>
 </main>;
}

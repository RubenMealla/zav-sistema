'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState,type CSSProperties,type ReactNode} from 'react';
import {Icono} from './icono';
import {Marca} from './marca';

type ProductoCatalogo={nombre:string;imagen:string;sprite:number};
type Familia={id:string;nombre:string;descripcion:string;icono:ReactNode;productos:ProductoCatalogo[]};

const iconosFamilia={
mortadelas:<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="7" y="11" width="42" height="26" rx="13"/><ellipse cx="49" cy="24" rx="9" ry="13" opacity=".78"/><circle className="familia-detalle" cx="46" cy="19" r="2.2"/><circle className="familia-detalle" cx="51" cy="26" r="1.8"/><circle className="familia-detalle" cx="45" cy="30" r="1.5"/></svg>,
chorizos:<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="7" y="8" width="15" height="31" rx="7.5" transform="rotate(-18 14.5 23.5)"/><rect x="24" y="7" width="15" height="32" rx="7.5" transform="rotate(8 31.5 23)"/><rect x="42" y="9" width="14" height="30" rx="7" transform="rotate(20 49 24)"/><path className="familia-detalle-trazo" d="M9 8 6 5m17 2 1-4m30 7 4-2"/></svg>,
salchichas:<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="7" y="10" width="49" height="11" rx="5.5"/><rect x="7" y="27" width="49" height="11" rx="5.5"/><path className="familia-detalle-trazo" d="M4 15h4m48 0h4M4 32h4m48 0h4"/></svg>,
morcillas:<svg viewBox="0 0 64 48" aria-hidden="true"><path fillRule="evenodd" d="M13 7c10-7 28-4 35 7 7 12 1 27-12 30-12 3-25-3-28-14-2-7 0-16 5-23Zm8 9c-5 4-6 11-2 16 4 5 12 6 17 2 6-4 7-12 3-17-4-5-12-6-18-1Z"/><path className="familia-detalle-trazo" d="m12 8-5-3m42 8 6-2"/></svg>,
jamones:<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M13 10c8-7 24-8 34-1 9 7 9 20 2 28-8 9-24 10-34 3-9-7-10-21-2-30Z"/><circle className="familia-detalle" cx="22" cy="26" r="6"/><rect x="46" y="7" width="11" height="7" rx="3.5" transform="rotate(-36 51.5 10.5)"/></svg>,
tocinos:<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M7 10c9-6 14 5 24 0 10-5 15 5 26 0v29c-11 5-16-5-26 0-10 5-15-6-24 0V10Z"/><path className="familia-detalle-trazo" d="M9 18c8-5 14 5 23 0 9-5 15 4 23 0M9 28c8-5 14 5 23 0 9-5 15 4 23 0"/></svg>,
especiales:<svg viewBox="0 0 64 48" aria-hidden="true"><ellipse cx="32" cy="24" rx="25" ry="18"/><circle className="familia-detalle" cx="22" cy="18" r="3"/><circle className="familia-detalle" cx="37" cy="15" r="2.3"/><circle className="familia-detalle" cx="43" cy="27" r="3.2"/><circle className="familia-detalle" cx="26" cy="31" r="2.4"/></svg>
};

const familias:Familia[]=[
{id:'mortadelas',nombre:'Mortadelas',descripcion:'Tres presentaciones del catálogo fotográfico ZAV.',icono:iconosFamilia.mortadelas,productos:[{nombre:'Mortadela Jamonada',imagen:'/catalogo-original/mortadela-jamonada.png',sprite:7},{nombre:'Mortadela Primavera',imagen:'/catalogo-original/mortadela-primavera.png',sprite:8},{nombre:'Mortadela Tradicional',imagen:'/catalogo-original/mortadela-tradicional.png',sprite:9}]},
{id:'chorizos',nombre:'Chorizos',descripcion:'Coctelero, parrillero, precocido y tipo español.',icono:iconosFamilia.chorizos,productos:[{nombre:'Chorizo Coctelero',imagen:'/catalogo-original/chorizo-coctelero.png',sprite:0},{nombre:'Chorizo Parrillero',imagen:'/catalogo-original/chorizo-parrillero.png',sprite:1},{nombre:'Chorizo Precocido',imagen:'/catalogo-original/chorizo-precocido.png',sprite:2},{nombre:'Chorizo Tipo Español',imagen:'/catalogo-original/chorizo-tipo-espanol.png',sprite:3}]},
{id:'salchichas',nombre:'Salchichas',descripcion:'Presentaciones tipo Súper Pancho y tipo Viena.',icono:iconosFamilia.salchichas,productos:[{nombre:'Salchicha Tipo Súper Pancho',imagen:'/catalogo-original/salchicha-tipo-super-pancho.png',sprite:10},{nombre:'Salchicha Tipo Viena',imagen:'/catalogo-original/salchicha-tipo-viena.png',sprite:11}]},
{id:'morcillas',nombre:'Morcillas',descripcion:'Morcilla artesanal dentro del catálogo ZAV.',icono:iconosFamilia.morcillas,productos:[{nombre:'Morcilla Artesanal',imagen:'/catalogo-original/morcilla-artesanal.png',sprite:6}]},
{id:'jamones',nombre:'Jamones',descripcion:'Jamón cocido light del catálogo fotográfico.',icono:iconosFamilia.jamones,productos:[{nombre:'Jamón Cocido Light',imagen:'/catalogo-original/jamon-cocido-light.png',sprite:5}]},
{id:'tocinos-ahumados',nombre:'Tocinos y ahumados',descripcion:'Tocino ahumado como presentación de esta familia.',icono:iconosFamilia.tocinos,productos:[{nombre:'Tocino Ahumado',imagen:'/catalogo-original/tocino-ahumado.png',sprite:12}]},
{id:'fiambres-especiales',nombre:'Fiambres especiales',descripcion:'Queso de chancho dentro de la línea de fiambres especiales.',icono:iconosFamilia.especiales,productos:[{nombre:'Queso de Chancho',imagen:'/catalogo-original/queso-de-chancho.png',sprite:4}]}
];

const destacados=[
{etiqueta:'CATÁLOGO ZAV',titulo:'Mortadela Primavera',texto:'Una de las presentaciones de la familia de mortadelas.',imagen:'/catalogo-original/mortadela-primavera.png',sprite:8},
{etiqueta:'CATÁLOGO ZAV',titulo:'Chorizo Coctelero',texto:'Presentación de la familia de chorizos ZAV.',imagen:'/catalogo-original/chorizo-coctelero.png',sprite:0},
{etiqueta:'CATÁLOGO ZAV',titulo:'Salchicha Tipo Viena',texto:'Presentación disponible en la familia de salchichas.',imagen:'/catalogo-original/salchicha-tipo-viena.png',sprite:11}];

function estiloSprite(indice:number):CSSProperties{
 const columna=indice%4, fila=Math.floor(indice/4);
 const posicion=(valor:number)=>valor===0?'0%':valor===3?'100%':(valor/3*100).toFixed(4)+'%';
 return {backgroundPosition:posicion(columna)+' '+posicion(fila)};
}

function FotoCatalogo({nombre,imagen,sprite,destacada=false}:{nombre:string;imagen:string;sprite:number;destacada?:boolean}){
 const[originalDisponible,setOriginalDisponible]=useState(false);
 useEffect(()=>{
  let activo=true;
  const precarga=new Image();
  precarga.onload=()=>{if(activo)setOriginalDisponible(true)};
  precarga.onerror=()=>{if(activo)setOriginalDisponible(false)};
  precarga.src=imagen;
  return()=>{activo=false;precarga.onload=null;precarga.onerror=null};
 },[imagen]);
 if(!originalDisponible){
  return <div className={destacada?'foto-sprite foto-sprite-destacada':'foto-sprite foto-sprite-producto'} style={estiloSprite(sprite)} role="img" aria-label={nombre}/>;
 }
 return <img
  className={destacada?'foto-original foto-original-destacada':'foto-original foto-original-producto'}
  src={imagen}
  alt={nombre}
  loading={destacada?'eager':'lazy'}
  decoding="async"
 />;
}

export function LandingPublica(){
 const[seccionActiva,setSeccionActiva]=useState('novedades');
 const[destacado,setDestacado]=useState(0);
 const[familiaActiva,setFamiliaActiva]=useState(familias[0].id);
 const familia=useMemo(()=>familias.find(x=>x.id===familiaActiva)??familias[0],[familiaActiva]);
 useEffect(()=>{const ss=['novedades','productos','zav'].map(id=>document.getElementById(id)).filter((e):e is HTMLElement=>Boolean(e));const o=new IntersectionObserver(es=>{const v=es.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(v?.target.id)setSeccionActiva(v.target.id)},{rootMargin:'-25% 0px -55% 0px',threshold:[.05,.2,.45]});ss.forEach(s=>o.observe(s));return()=>o.disconnect()},[]);
 const mover=(d:number)=>setDestacado(a=>(a+d+destacados.length)%destacados.length);
 return <div className="sitio-publico">
 <a className="saltar-contenido" href="#principal">Saltar al contenido</a>
 <header className="publico-header"><div className="contenedor-publico publico-header-interior"><Link href="/" aria-label="ZAV, inicio" className="publico-marca"><Marca compacta/></Link><nav className="publico-nav" aria-label="Navegación principal">{[['novedades','Noticias'],['productos','Productos'],['zav','Nosotros']].map(([id,t])=><a key={id} href={'#'+id} className={seccionActiva===id?'activo':''} aria-current={seccionActiva===id?'location':undefined}>{t}</a>)}</nav><Link className="publico-acceso" href="/acceso">Acceso interno <Icono nombre="flecha" tamano={15}/></Link></div></header>
 <main id="principal" tabIndex={-1}>
  <section id="novedades" className="publico-hero publico-seccion-ancla"><div className="contenedor-publico publico-hero-grid"><div className="publico-hero-copy"><span className="publico-kicker">TARIJA · BOLIVIA</span><h1>Fiambres y embutidos <em>ZAV.</em></h1><p>Catálogo público de productos y novedades de Fiambres y Embutidos ZAV.</p><a className="publico-link-hero" href="#productos">Explorar catálogo <Icono nombre="flecha" tamano={16}/></a></div><div className="publico-noticia" aria-roledescription="carrusel" aria-label="Contenido destacado de ZAV"><div className="publico-noticia-imagen"><FotoCatalogo key={destacados[destacado].imagen} nombre={destacados[destacado].titulo} imagen={destacados[destacado].imagen} sprite={destacados[destacado].sprite} destacada/></div><div className="publico-noticia-contenido" aria-live="polite"><div><span>{destacados[destacado].etiqueta}</span><h2>{destacados[destacado].titulo}</h2><p>{destacados[destacado].texto}</p></div><div className="publico-noticia-controles"><button type="button" onClick={()=>mover(-1)} aria-label="Contenido anterior">←</button><div className="publico-noticia-puntos">{destacados.map((x,i)=><button type="button" key={x.titulo} className={i===destacado?'activo':''} onClick={()=>setDestacado(i)} aria-label={'Ver '+x.titulo} aria-pressed={i===destacado}/>)}</div><button type="button" onClick={()=>mover(1)} aria-label="Contenido siguiente">→</button></div></div></div></div></section>
  <section id="productos" className="publico-productos publico-seccion-ancla"><div className="contenedor-publico"><header className="publico-seccion-intro publico-productos-intro"><div><span className="eyebrow">PRODUCTOS</span><h2>Siete familias de productos ZAV.</h2></div><p>Selecciona una familia para ver sus presentaciones y fotografías reales del catálogo.</p></header><div className="familias-grid" role="group" aria-label="Familias de productos">{familias.map(x=><button type="button" key={x.id} className={familiaActiva===x.id?'familia-card activa':'familia-card'} aria-pressed={familiaActiva===x.id} onClick={()=>setFamiliaActiva(x.id)}><span className="familia-icono">{x.icono}</span><span>{x.nombre}</span></button>)}</div><div className="catalogo-familia" aria-live="polite"><div className="catalogo-familia-cabecera"><div><span className="eyebrow">{familia.nombre.toUpperCase()}</span><h3>{familia.nombre}</h3><p>{familia.descripcion}</p></div><span className="catalogo-conteo">{familia.productos.length.toString().padStart(2,'0')} productos</span></div><div className="productos-grid">{familia.productos.map(p=><article className="producto-publico" key={p.nombre}><div className="producto-publico-imagen"><FotoCatalogo nombre={p.nombre} imagen={p.imagen} sprite={p.sprite}/></div><div className="producto-publico-pie"><span>{familia.nombre}</span><h4>{p.nombre}</h4></div></article>)}</div></div></div></section>
  <section id="zav" className="publico-zav publico-seccion-ancla"><div className="contenedor-publico publico-zav-grid"><div className="publico-zav-marca"><Marca grande soloSimbolo/><span className="publico-zav-marca-leyenda">FIAMBRES Y EMBUTIDOS · TARIJA</span></div><div className="publico-zav-copy"><span className="eyebrow">NOSOTROS</span><h2>Una marca tarijeña dedicada a fiambres y embutidos.</h2><p>Fiambres y Embutidos ZAV opera en Tarija, Bolivia, y su actividad pública está vinculada a la elaboración y comercialización de productos cárnicos y embutidos.</p><p>El Ministerio de Salud y Deportes incluyó a Fiambres y Embutidos ZAV en sus listas nacionales de empresas autorizadas para la venta de salchichas en las campañas de San Juan de 2023 y 2024, después de procesos de análisis y verificación de parámetros de calidad.</p><div className="publico-zav-datos"><div className="publico-zav-dato"><span>ORIGEN</span><strong>Tarija, Bolivia</strong></div><div className="publico-zav-dato"><span>ACTIVIDAD</span><strong>Fiambres y embutidos</strong></div><div className="publico-zav-dato"><span>CATÁLOGO</span><strong>7 familias · 13 fotografías</strong></div><div className="publico-zav-dato"><span>REFERENCIA PÚBLICA</span><strong>Ministerio de Salud 2023–2024</strong></div></div><div className="publico-zav-enlaces"><a className="publico-link" href="https://minsalud.gob.bo/8175-salud-autoriza-a-42-empresas-para-la-venta-de-salchichas-a-nivel-nacional-que-cumplen-con-estandares-de-calidad-exigidos" target="_blank" rel="noreferrer">Ver referencia oficial 2024 <Icono nombre="flecha" tamano={16}/></a><Link className="publico-link" href="/acceso">Ir al sistema interno <Icono nombre="flecha" tamano={16}/></Link></div></div></div></section>
 </main>
 <footer className="publico-footer"><div className="contenedor-publico publico-footer-grid"><div className="publico-footer-identidad"><Marca compacta/><p>Catálogo público de Fiambres y Embutidos ZAV.</p><p>Tarija, Bolivia.</p></div><nav aria-label="Navegación del pie"><h3>Explorar</h3><a href="#novedades">Noticias</a><a href="#productos">Productos</a><a href="#zav">Nosotros</a></nav><div className="publico-footer-col"><h3>Catálogo</h3><a href="#productos">7 familias de productos</a><span>13 fotografías entregadas por ZAV</span><a href="#productos">Ver presentaciones</a></div><div className="publico-footer-col"><h3>Información</h3><div className="publico-footer-redes"><a href="https://facebook.com/863449187010368" target="_blank" rel="noreferrer">Facebook</a><a href="https://minsalud.gob.bo/8175-salud-autoriza-a-42-empresas-para-la-venta-de-salchichas-a-nivel-nacional-que-cumplen-con-estandares-de-calidad-exigidos" target="_blank" rel="noreferrer">Ministerio de Salud · 2024</a><span>Tarija, Bolivia</span></div><Link className="publico-link" href="/acceso">Acceso interno</Link></div></div><div className="contenedor-publico publico-footer-legal"><span>ZAV · Fiambres &amp; Embutidos</span><span>Sitio público · Sistema interno separado · © 2026</span></div></footer>
 </div>;
}

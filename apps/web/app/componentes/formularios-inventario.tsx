'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  cambiarCondicionLote,
  registrarLote,
  registrarProducto,
  registrarTraslado,
} from '../panel/acciones';
import { editarProducto } from '../panel/acciones-productos-e3';
import { BotonEnviar } from './interacciones';

type ProductoOpcion = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
};

type LoteOpcion = {
  id: string;
  codigo: string;
  condicion: string;
};

type ProductoEditable = {
  id: string;
  codigo: string;
  nombre: string;
  familia: string;
  presentacion: string;
  pesoGramos: number;
  precioBob: string;
};

const FAMILIAS_ZAV = [
  'Mortadelas',
  'Chorizos',
  'Salchichas',
  'Morcillas',
  'Jamones',
  'Tocinos y ahumados',
  'Fiambres especiales',
] as const;

function fechaHoyBolivia() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valor.year}-${valor.month}-${valor.day}`;
}

function sumarDias(fecha: string, dias: number) {
  const base = new Date(`${fecha}T12:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return fecha;
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

function mayorFecha(a: string, b: string) {
  return a >= b ? a : b;
}

function normalizarCodigo(valor: string) {
  return valor.toUpperCase().replace(/\s+/g, '-');
}

function CampoAyuda({ id, children }: { id: string; children: ReactNode }) {
  return <small id={id} className="campo-ayuda">{children}</small>;
}

export function FormularioNuevoProducto() {
  const baseId = useId();
  const [familia, setFamilia] = useState('');
  const [codigo, setCodigo] = useState('PRD-001');
  const [codigoAutomatico, setCodigoAutomatico] = useState(true);
  const [revisionCodigo, setRevisionCodigo] = useState(0);
  const [estadoCodigo, setEstadoCodigo] = useState<'listo' | 'cargando' | 'error'>('listo');

  useEffect(() => {
    if (!codigoAutomatico || familia.trim().length < 2) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(async () => {
      setEstadoCodigo('cargando');
      try {
        const respuesta = await fetch(`/api/codigos/producto?familia=${encodeURIComponent(familia.trim())}`, {
          cache: 'no-store',
          signal: controlador.signal,
        });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const datos = await respuesta.json() as { codigo?: string };
        if (datos.codigo) setCodigo(datos.codigo);
        setEstadoCodigo('listo');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setEstadoCodigo('error');
      }
    }, 320);
    return () => {
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [codigoAutomatico, familia, revisionCodigo]);

  const idCodigo = `${baseId}-codigo`;
  const idFamilia = `${baseId}-familia`;
  const idNombre = `${baseId}-nombre`;
  const idPresentacion = `${baseId}-presentacion`;
  const idPeso = `${baseId}-peso`;
  const idPrecio = `${baseId}-precio`;

  return (
    <form action={registrarProducto} className="formulario formulario-modal">
      <section className="form-seccion">
        <header className="form-seccion-cabecera">
          <div><strong>Identificación</strong><p>El código se propone automáticamente y sigue siendo editable.</p></div>
          <span className="form-paso">01</span>
        </header>
        <div className="form-grid">
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={idFamilia}>Familia</label><span>Obligatorio</span></div>
            <input
              id={idFamilia}
              name="familia"
              list={`${baseId}-familias`}
              minLength={2}
              maxLength={70}
              required
              value={familia}
              onChange={(evento) => setFamilia(evento.target.value)}
              placeholder="Ej. Salchichas"
              autoComplete="off"
            />
            <datalist id={`${baseId}-familias`}>{FAMILIAS_ZAV.map((item) => <option key={item} value={item} />)}</datalist>
            <CampoAyuda id={`${idFamilia}-ayuda`}>Puedes usar una familia existente o escribir una nueva.</CampoAyuda>
          </div>

          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={idCodigo}>Código</label><span>Obligatorio</span></div>
            <div className="campo-control-compuesto">
              <input
                id={idCodigo}
                name="codigo"
                minLength={2}
                maxLength={40}
                pattern="[A-Za-z0-9._-]{2,40}"
                title="Usa letras, números, punto, guion o guion bajo."
                required
                value={codigo}
                onChange={(evento) => {
                  setCodigo(normalizarCodigo(evento.target.value));
                  setCodigoAutomatico(false);
                }}
                aria-describedby={`${idCodigo}-ayuda`}
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button
                type="button"
                className="boton boton-terciario boton-sugerencia"
                onClick={() => {
                  setCodigoAutomatico(true);
                  setRevisionCodigo((valor) => valor + 1);
                }}
                disabled={familia.trim().length < 2 || estadoCodigo === 'cargando'}
              >
                {estadoCodigo === 'cargando' ? 'Calculando…' : 'Sugerir'}
              </button>
            </div>
            <CampoAyuda id={`${idCodigo}-ayuda`}>
              {estadoCodigo === 'error'
                ? 'No se pudo calcular la sugerencia. Puedes escribir el código manualmente.'
                : 'Formato interno sugerido: SIGLA-###. La sugerencia no reemplaza tu criterio y puede editarse.'}
            </CampoAyuda>
          </div>

          <div className="campo campo-ancho">
            <div className="campo-etiqueta"><label htmlFor={idNombre}>Nombre comercial</label><span>Obligatorio</span></div>
            <input id={idNombre} name="nombre" minLength={2} maxLength={120} required placeholder="Ej. Salchicha Tipo Viena" autoComplete="off" />
          </div>
        </div>
      </section>

      <section className="form-seccion">
        <header className="form-seccion-cabecera">
          <div><strong>Presentación comercial</strong><p>Completa los datos que se usarán en catálogo, inventario y pedidos.</p></div>
          <span className="form-paso">02</span>
        </header>
        <div className="form-grid">
          <div className="campo campo-ancho">
            <div className="campo-etiqueta"><label htmlFor={idPresentacion}>Presentación</label><span>Obligatorio</span></div>
            <input id={idPresentacion} name="presentacion" minLength={2} maxLength={100} required placeholder="Ej. Paquete de 500 gramos" />
          </div>
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={idPeso}>Peso (gramos)</label><span>Obligatorio</span></div>
            <input id={idPeso} name="pesoGramos" type="number" min={1} step={1} inputMode="numeric" required placeholder="500" />
            <CampoAyuda id={`${idPeso}-ayuda`}>Solo números enteros mayores a cero.</CampoAyuda>
          </div>
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={idPrecio}>Precio (Bs)</label><span>Obligatorio</span></div>
            <input id={idPrecio} name="precioBob" type="number" min={0} step="0.01" inputMode="decimal" required placeholder="25.50" />
            <CampoAyuda id={`${idPrecio}-ayuda`}>Hasta dos decimales.</CampoAyuda>
          </div>
        </div>
      </section>

      <div className="form-nota">
        <strong>Código editable</strong>
        <span>El código de producto es una convención interna del sistema; la unicidad se valida al guardar.</span>
      </div>

      <div className="modal-acciones">
        <BotonEnviar confirmacion={{ titulo: 'Registrar producto', mensaje: 'Se agregará esta presentación al catálogo interno de ZAV.', confirmar: 'Sí, registrar producto' }}>
          Guardar producto
        </BotonEnviar>
      </div>
    </form>
  );
}

export function FormularioEditarProducto({ producto }: { producto: ProductoEditable }) {
  const baseId = useId();
  return (
    <form action={editarProducto} className="formulario formulario-modal">
      <input type="hidden" name="productoId" value={producto.id} />
      <section className="form-seccion">
        <header className="form-seccion-cabecera">
          <div><strong>Identificación del producto</strong><p>Conserva el código si se trata de la misma presentación; cámbialo solo cuando corresponda.</p></div>
          <span className="form-paso">01</span>
        </header>
        <div className="form-grid">
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-codigo`}>Código</label><span>Obligatorio</span></div>
            <input id={`${baseId}-codigo`} name="codigo" minLength={2} maxLength={40} pattern="[A-Za-z0-9._-]{2,40}" required defaultValue={producto.codigo} onInput={(e) => { e.currentTarget.value = normalizarCodigo(e.currentTarget.value); }} />
            <CampoAyuda id={`${baseId}-codigo-ayuda`}>Letras, números, punto, guion o guion bajo.</CampoAyuda>
          </div>
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-familia`}>Familia</label><span>Obligatorio</span></div>
            <input id={`${baseId}-familia`} name="familia" minLength={2} maxLength={70} required defaultValue={producto.familia} />
          </div>
          <div className="campo campo-ancho">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-nombre`}>Nombre comercial</label><span>Obligatorio</span></div>
            <input id={`${baseId}-nombre`} name="nombre" minLength={2} maxLength={120} required defaultValue={producto.nombre} />
          </div>
        </div>
      </section>

      <section className="form-seccion">
        <header className="form-seccion-cabecera">
          <div><strong>Presentación y precio</strong><p>Estos cambios no alteran el historial de lotes ya registrado.</p></div>
          <span className="form-paso">02</span>
        </header>
        <div className="form-grid">
          <div className="campo campo-ancho">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-presentacion`}>Presentación</label><span>Obligatorio</span></div>
            <input id={`${baseId}-presentacion`} name="presentacion" minLength={2} maxLength={100} required defaultValue={producto.presentacion} />
          </div>
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-peso`}>Peso (gramos)</label><span>Obligatorio</span></div>
            <input id={`${baseId}-peso`} name="pesoGramos" type="number" min={1} step={1} required defaultValue={producto.pesoGramos} />
          </div>
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-precio`}>Precio (Bs)</label><span>Obligatorio</span></div>
            <input id={`${baseId}-precio`} name="precioBob" type="number" min={0} step="0.01" required defaultValue={producto.precioBob} />
          </div>
        </div>
      </section>
      <div className="modal-acciones">
        <BotonEnviar pendiente="Guardando…" confirmacion={{ titulo: 'Guardar cambios del producto', mensaje: 'Se actualizarán los datos comerciales del producto. El historial de lotes no se modificará.', confirmar: 'Sí, guardar cambios' }}>
          Guardar cambios
        </BotonEnviar>
      </div>
    </form>
  );
}

export function FormularioNuevoLote({ productos, operacionClave }: { productos: ProductoOpcion[]; operacionClave: string }) {
  const baseId = useId();
  const hoy = useMemo(() => fechaHoyBolivia(), []);
  const [productoId, setProductoId] = useState('');
  const [elaboradoEl, setElaboradoEl] = useState(hoy);
  const [venceEl, setVenceEl] = useState('');
  const [codigo, setCodigo] = useState('TJ-ZAV-');
  const [codigoAutomatico, setCodigoAutomatico] = useState(true);
  const [revisionCodigo, setRevisionCodigo] = useState(0);
  const [estadoCodigo, setEstadoCodigo] = useState<'listo' | 'cargando' | 'error'>('listo');

  const minimoVencimiento = useMemo(
    () => mayorFecha(hoy, sumarDias(elaboradoEl || hoy, 1)),
    [elaboradoEl, hoy],
  );

  useEffect(() => {
    if (!codigoAutomatico || !productoId || !elaboradoEl) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(async () => {
      setEstadoCodigo('cargando');
      try {
        const respuesta = await fetch(`/api/codigos/lote?productoId=${encodeURIComponent(productoId)}&elaboradoEl=${encodeURIComponent(elaboradoEl)}`, {
          cache: 'no-store',
          signal: controlador.signal,
        });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const datos = await respuesta.json() as { codigo?: string };
        if (datos.codigo) setCodigo(datos.codigo);
        setEstadoCodigo('listo');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setEstadoCodigo('error');
      }
    }, 250);
    return () => {
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [codigoAutomatico, elaboradoEl, productoId, revisionCodigo]);

  return (
    <form action={registrarLote} className="formulario formulario-modal">
      <input type="hidden" name="operacionClave" value={operacionClave} />

      <section className="form-seccion">
        <header className="form-seccion-cabecera">
          <div><strong>Identificación y trazabilidad</strong><p>Selecciona el producto y el sistema propondrá un código de lote editable.</p></div>
          <span className="form-paso">01</span>
        </header>
        <div className="form-grid">
          <div className="campo campo-ancho">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-producto`}>Producto</label><span>Obligatorio</span></div>
            <select id={`${baseId}-producto`} name="productoId" required value={productoId} onChange={(evento) => { setProductoId(evento.target.value); setCodigoAutomatico(true); }}>
              <option value="" disabled>Selecciona un producto</option>
              {productos.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
            </select>
          </div>

          <div className="campo campo-ancho">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-codigo`}>Código de lote</label><span>Obligatorio</span></div>
            <div className="campo-control-compuesto">
              <input
                id={`${baseId}-codigo`}
                name="codigo"
                minLength={2}
                maxLength={60}
                pattern="[A-Za-z0-9._-]{2,60}"
                required
                value={codigo}
                onChange={(evento) => {
                  setCodigo(normalizarCodigo(evento.target.value));
                  setCodigoAutomatico(false);
                }}
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button
                type="button"
                className="boton boton-terciario boton-sugerencia"
                disabled={!productoId || estadoCodigo === 'cargando'}
                onClick={() => {
                  setCodigoAutomatico(true);
                  setRevisionCodigo((valor) => valor + 1);
                }}
              >
                {estadoCodigo === 'cargando' ? 'Calculando…' : 'Regenerar'}
              </button>
            </div>
            <CampoAyuda id={`${baseId}-codigo-ayuda`}>
              {estadoCodigo === 'error'
                ? 'No se pudo calcular la sugerencia. Escribe el código del lote manualmente.'
                : 'Sugerencia interna: TJ-ZAV-CÓDIGO_PRODUCTO-AAAAMMDD-##. Debe coincidir con el lote físico/etiquetado.'}
            </CampoAyuda>
          </div>

          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-elaborado`}>Fecha de elaboración</label><span>Obligatorio</span></div>
            <input
              id={`${baseId}-elaborado`}
              name="elaboradoEl"
              type="date"
              required
              value={elaboradoEl}
              max={hoy}
              onChange={(evento) => {
                const siguiente = evento.target.value;
                setElaboradoEl(siguiente);
                setCodigoAutomatico(true);
                const siguienteMinimo = mayorFecha(hoy, sumarDias(siguiente || hoy, 1));
                if (venceEl && venceEl < siguienteMinimo) setVenceEl('');
              }}
            />
            <CampoAyuda id={`${baseId}-elaborado-ayuda`}>Hoy viene precargado. No se permiten fechas futuras; si el lote se elaboró antes, registra la fecha real.</CampoAyuda>
          </div>

          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-vence`}>Fecha de vencimiento</label><span>Obligatorio</span></div>
            <input id={`${baseId}-vence`} name="venceEl" type="date" required value={venceEl} min={minimoVencimiento} onChange={(evento) => setVenceEl(evento.target.value)} />
            <CampoAyuda id={`${baseId}-vence-ayuda`}>Debe ser posterior a la elaboración y no puede estar vencida al registrar el ingreso.</CampoAyuda>
          </div>
        </div>
      </section>

      <section className="form-seccion">
        <header className="form-seccion-cabecera">
          <div><strong>Ingreso inicial</strong><p>El lote ingresará RETENIDO en Producción y Almacenamiento.</p></div>
          <span className="form-paso">02</span>
        </header>
        <div className="form-grid">
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-cantidad`}>Cantidad inicial</label><span>Obligatorio</span></div>
            <input id={`${baseId}-cantidad`} name="cantidadInicial" type="number" min={1} step={1} inputMode="numeric" required placeholder="1" />
          </div>
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-ubicacion`}>Ubicación inicial</label><span>Automática</span></div>
            <input id={`${baseId}-ubicacion`} value="Producción y Almacenamiento" readOnly aria-label="Ubicación inicial" />
            <CampoAyuda id={`${baseId}-ubicacion-ayuda`}>La ubicación inicial no se cambia desde este formulario.</CampoAyuda>
          </div>
        </div>
      </section>

      <div className="form-nota form-nota-importante">
        <strong>La fecha de vencimiento no se inventa</strong>
        <span>No se autocompleta porque depende de la vida útil real y aprobada para cada producto.</span>
      </div>

      <div className="modal-acciones">
        <BotonEnviar disabled={productos.length === 0} confirmacion={{ titulo: 'Registrar lote e ingreso', mensaje: 'Se creará el lote con su existencia inicial en Producción y Almacenamiento. La operación quedará en la trazabilidad.', confirmar: 'Sí, registrar lote' }}>
          Guardar lote e ingreso
        </BotonEnviar>
      </div>
    </form>
  );
}

export function FormularioCondicionLote({ lotes, operacionClave }: { lotes: LoteOpcion[]; operacionClave: string }) {
  const baseId = useId();
  return (
    <form action={cambiarCondicionLote} className="formulario formulario-modal">
      <input type="hidden" name="operacionClave" value={operacionClave} />
      <section className="form-seccion">
        <header className="form-seccion-cabecera">
          <div><strong>Decisión sobre el lote</strong><p>La condición comercial no modifica la existencia física.</p></div>
          <span className="form-paso">01</span>
        </header>
        <div className="form-grid form-grid-una">
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-lote`}>Lote</label><span>Obligatorio</span></div>
            <select id={`${baseId}-lote`} name="loteId" required defaultValue=""><option value="" disabled>Selecciona un lote</option>{lotes.map((l) => <option key={l.id} value={l.id}>{l.codigo} · {l.condicion}</option>)}</select>
          </div>
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-accion`}>Acción</label><span>Obligatorio</span></div>
            <select id={`${baseId}-accion`} name="accion" required defaultValue="liberar"><option value="liberar">Liberar para disponibilidad comercial</option><option value="bloquear">Bloquear lote</option></select>
          </div>
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-motivo`}>Motivo de la decisión</label><span>Obligatorio</span></div>
            <input id={`${baseId}-motivo`} name="motivo" minLength={5} maxLength={250} required placeholder="Describe brevemente el motivo" />
            <CampoAyuda id={`${baseId}-motivo-ayuda`}>Mínimo 5 caracteres. Quedará registrado en la auditoría del lote.</CampoAyuda>
          </div>
        </div>
      </section>
      <div className="modal-acciones">
        <BotonEnviar disabled={lotes.length === 0} confirmacion={{ titulo: 'Confirmar cambio de condición', mensaje: 'Se registrará la liberación o bloqueo del lote con el motivo indicado y quedará asociado al usuario autenticado.', confirmar: 'Sí, guardar condición' }}>
          Guardar condición
        </BotonEnviar>
      </div>
    </form>
  );
}

export function FormularioTraslado({ lotes, operacionClave }: { lotes: LoteOpcion[]; operacionClave: string }) {
  const baseId = useId();
  const [origen, setOrigen] = useState('PRODUCCION_ALMACENAMIENTO');
  const [destino, setDestino] = useState('VENTA_DESPACHO');
  const ubicaciones = [
    { codigo: 'PRODUCCION_ALMACENAMIENTO', nombre: 'Producción y Almacenamiento' },
    { codigo: 'VENTA_DESPACHO', nombre: 'Venta y Despacho' },
  ];

  return (
    <form action={registrarTraslado} className="formulario formulario-modal">
      <input type="hidden" name="operacionClave" value={operacionClave} />
      <section className="form-seccion">
        <header className="form-seccion-cabecera">
          <div><strong>Movimiento físico</strong><p>Origen y destino nunca pueden ser la misma ubicación.</p></div>
          <span className="form-paso">01</span>
        </header>
        <div className="form-grid">
          <div className="campo campo-ancho">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-lote`}>Lote a trasladar</label><span>Obligatorio</span></div>
            <select id={`${baseId}-lote`} name="loteId" required defaultValue=""><option value="" disabled>Selecciona un lote</option>{lotes.map((l) => <option key={l.id} value={l.id}>{l.codigo} · {l.condicion}</option>)}</select>
          </div>
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-cantidad`}>Cantidad</label><span>Obligatorio</span></div>
            <input id={`${baseId}-cantidad`} name="cantidad" type="number" min={1} step={1} inputMode="numeric" required placeholder="1" />
          </div>
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-origen`}>Origen</label><span>Obligatorio</span></div>
            <select id={`${baseId}-origen`} name="origenCodigo" value={origen} onChange={(evento) => {
              const siguiente = evento.target.value;
              setOrigen(siguiente);
              if (destino === siguiente) setDestino(siguiente === 'PRODUCCION_ALMACENAMIENTO' ? 'VENTA_DESPACHO' : 'PRODUCCION_ALMACENAMIENTO');
            }}>
              {ubicaciones.map((u) => <option key={u.codigo} value={u.codigo}>{u.nombre}</option>)}
            </select>
          </div>
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-destino`}>Destino</label><span>Obligatorio</span></div>
            <select id={`${baseId}-destino`} name="destinoCodigo" value={destino} onChange={(evento) => setDestino(evento.target.value)}>
              {ubicaciones.filter((u) => u.codigo !== origen).map((u) => <option key={u.codigo} value={u.codigo}>{u.nombre}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="form-seccion">
        <header className="form-seccion-cabecera">
          <div><strong>Referencia del movimiento</strong><p>Ayuda a reconocer la operación posteriormente.</p></div>
          <span className="form-paso">02</span>
        </header>
        <div className="form-grid">
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-referencia`}>Referencia</label><span>Opcional</span></div>
            <input id={`${baseId}-referencia`} name="referencia" maxLength={80} placeholder="Ej. TR-001" />
          </div>
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-motivo`}>Motivo</label><span>Opcional</span></div>
            <input id={`${baseId}-motivo`} name="motivo" maxLength={250} placeholder="Ej. Reposición de stock de venta" />
          </div>
        </div>
      </section>

      <div className="modal-acciones">
        <BotonEnviar disabled={lotes.length === 0} confirmacion={{ titulo: 'Registrar traslado', mensaje: 'Se moverá existencia física entre ubicaciones y el movimiento quedará registrado en el historial del lote.', confirmar: 'Sí, registrar traslado' }}>
          Guardar traslado
        </BotonEnviar>
      </div>
    </form>
  );
}

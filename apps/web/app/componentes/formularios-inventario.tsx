'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  cambiarCondicionLote,
  registrarLote,
  registrarTraslado,
} from '../panel/acciones';
import { SelectorInventario } from './selector-inventario';
import { BotonEnviar } from './interacciones';
import { manejarInvalido, limpiarInvalido, PATRON_CODIGO_LOTE } from './validacion-formularios';

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

export function FormularioNuevoLote({ productos, operacionClave }: { productos: ProductoOpcion[]; operacionClave: string }) {
  const baseId = useId();
  const hoy = useMemo(() => fechaHoyBolivia(), []);
  const [productoId, setProductoId] = useState('');
  const [elaboradoEl, setElaboradoEl] = useState(hoy);
  const [venceEl, setVenceEl] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoAutomatico, setCodigoAutomatico] = useState(true);
  const [revisionCodigo, setRevisionCodigo] = useState(0);
  const [estadoCodigo, setEstadoCodigo] = useState<'listo' | 'cargando' | 'error'>('listo');
  const [codigoErrorSugerencia, setCodigoErrorSugerencia] = useState<string | null>(null);

  const minimoVencimiento = useMemo(
    () => mayorFecha(hoy, sumarDias(elaboradoEl || hoy, 1)),
    [elaboradoEl, hoy],
  );
  const elaboracionHistorica = Boolean(elaboradoEl && elaboradoEl < hoy);

  useEffect(() => {
    if (!codigoAutomatico || !productoId || !elaboradoEl) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(async () => {
      setEstadoCodigo('cargando');
      setCodigoErrorSugerencia(null);
      try {
        const respuesta = await fetch(`/api/codigos/lote?productoId=${encodeURIComponent(productoId)}&elaboradoEl=${encodeURIComponent(elaboradoEl)}`, {
          cache: 'no-store',
          signal: controlador.signal,
        });
        if (!respuesta.ok) {
          setCodigoErrorSugerencia(`HTTP ${respuesta.status}`);
          throw new Error(`HTTP ${respuesta.status}`);
        }
        const datos = await respuesta.json() as { codigo?: string };
        if (datos.codigo) setCodigo(datos.codigo);
        setEstadoCodigo('listo');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setEstadoCodigo('error');
          setCodigoErrorSugerencia((actual) => actual ?? 'SIN RESPUESTA HTTP');
        }
      }
    }, 250);
    return () => {
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [codigoAutomatico, elaboradoEl, productoId, revisionCodigo]);

  return (
    <form action={registrarLote} className="formulario formulario-modal" onInvalid={manejarInvalido} onInput={limpiarInvalido}>
      <input type="hidden" name="operacionClave" value={operacionClave} />

      <section className="form-seccion">
        <header className="form-seccion-cabecera">
          <div><strong>Identificación y trazabilidad</strong><p>Selecciona el producto y el sistema propondrá un código de lote editable.</p></div>
          <span className="form-paso">01</span>
        </header>
        <div className="form-grid">
          <div className="campo campo-ancho">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-producto`}>Producto</label><span>Obligatorio</span></div>
            <SelectorInventario tipo="productos" iniciales={productos.filter(p => p.activo)} id={`${baseId}-producto`} name="productoId" value={productoId} onChange={id => { setProductoId(id); if (codigoAutomatico) setCodigo(''); }} />
          </div>

          <div className="campo campo-ancho">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-codigo`}>Código de lote</label><span>Obligatorio</span></div>
            <div className="campo-control-compuesto">
              <input
                id={`${baseId}-codigo`}
                name="codigo"
                minLength={2}
                maxLength={60}
                pattern={PATRON_CODIGO_LOTE} data-validacion="El código debe empezar con letra o número y contener de 2 a 60 letras, números, puntos, guiones o guiones bajos."
                required
                value={codigo}
                onChange={(evento) => {
                  setCodigo(normalizarCodigo(evento.target.value));
                  setCodigoAutomatico(false);
                  setEstadoCodigo('listo');
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
                  setCodigo('');
                  setRevisionCodigo((valor) => valor + 1);
                }}
              >
                {estadoCodigo === 'cargando' ? 'Calculando…' : 'Regenerar'}
              </button>
            </div>
            <CampoAyuda id={`${baseId}-codigo-ayuda`}>
              {estadoCodigo === 'error'
                ? `${codigoErrorSugerencia ?? 'ERROR'} · No se pudo calcular la sugerencia. Escribe el código del lote manualmente.`
                : codigoAutomatico
                  ? 'Generado automáticamente como TJ-ZAV-CÓDIGO_PRODUCTO-AAAAMMDD-##. Puedes editarlo, pero debe coincidir con el lote físico/etiquetado.'
                  : 'Código de lote editado manualmente. Usa “Regenerar” para recuperar la propuesta automática.'}
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
                if (codigoAutomatico) setCodigo('');
                const siguienteMinimo = mayorFecha(hoy, sumarDias(siguiente || hoy, 1));
                if (venceEl && venceEl < siguienteMinimo) setVenceEl('');
              }}
            />
            <CampoAyuda id={`${baseId}-elaborado-ayuda`}>Hoy viene precargado. Esta es la fecha real de elaboración, no la fecha de registro; por trazabilidad puede ser anterior, pero nunca futura.</CampoAyuda>
          </div>

          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-vence`}>Fecha de vencimiento</label><span>Obligatorio</span></div>
            <input id={`${baseId}-vence`} name="venceEl" type="date" required value={venceEl} min={minimoVencimiento} onChange={(evento) => setVenceEl(evento.target.value)} />
            <CampoAyuda id={`${baseId}-vence-ayuda`}>Debe ser posterior a la elaboración y no puede estar vencida al registrar el ingreso.</CampoAyuda>
          </div>
        </div>
        {elaboracionHistorica && (
          <div className="form-alerta-fecha" role="note">
            <strong>Fecha de elaboración anterior a hoy</strong>
            <span>Es válida solo si coincide con la fecha real del lote físico. Revísala antes de guardar para evitar una trazabilidad incorrecta.</span>
          </div>
        )}
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
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-registro`}>Fecha de registro</label><span>Automática</span></div>
            <input id={`${baseId}-registro`} value={hoy} readOnly aria-label="Fecha de registro" />
            <CampoAyuda id={`${baseId}-registro-ayuda`}>El instante de registro lo asigna el servidor al guardar; el usuario no puede retrocederlo.</CampoAyuda>
          </div>
          <div className="campo campo-ancho">
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
        <BotonEnviar disabled={productos.length === 0} confirmacion={{ titulo: 'Registrar lote e ingreso', mensaje: elaboracionHistorica ? 'La fecha de elaboración es anterior a hoy. Confirma que coincide con el lote físico antes de registrar el ingreso y su trazabilidad.' : 'Se creará el lote con su existencia inicial en Producción y Almacenamiento. La operación quedará en la trazabilidad.', confirmar: 'Sí, registrar lote' }}>
          Guardar lote e ingreso
        </BotonEnviar>
      </div>
    </form>
  );
}

export function FormularioCondicionLote({ lotes, operacionClave }: { lotes: LoteOpcion[]; operacionClave: string }) {
  const baseId = useId();
  return (
    <form action={cambiarCondicionLote} className="formulario formulario-modal" onInvalid={manejarInvalido} onInput={limpiarInvalido}>
      <input type="hidden" name="operacionClave" value={operacionClave} />
      <section className="form-seccion">
        <header className="form-seccion-cabecera">
          <div><strong>Decisión sobre el lote</strong><p>La condición comercial no modifica la existencia física.</p></div>
          <span className="form-paso">01</span>
        </header>
        <div className="form-grid form-grid-una">
          <div className="campo">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-lote`}>Lote</label><span>Obligatorio</span></div>
            <SelectorInventario tipo="lotes" iniciales={lotes} id={`${baseId}-lote`} name="loteId" />
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
        <BotonEnviar confirmacion={{ titulo: 'Confirmar cambio de condición', mensaje: 'Se registrará la liberación o bloqueo del lote con el motivo indicado y quedará asociado al usuario autenticado.', confirmar: 'Sí, guardar condición' }}>
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
    <form action={registrarTraslado} className="formulario formulario-modal" onInvalid={manejarInvalido} onInput={limpiarInvalido}>
      <input type="hidden" name="operacionClave" value={operacionClave} />
      <section className="form-seccion">
        <header className="form-seccion-cabecera">
          <div><strong>Movimiento físico</strong><p>Origen y destino nunca pueden ser la misma ubicación.</p></div>
          <span className="form-paso">01</span>
        </header>
        <div className="form-grid">
          <div className="campo campo-ancho">
            <div className="campo-etiqueta"><label htmlFor={`${baseId}-lote`}>Lote a trasladar</label><span>Obligatorio</span></div>
            <SelectorInventario tipo="lotes" iniciales={lotes} id={`${baseId}-lote`} name="loteId" />
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
        <BotonEnviar confirmacion={{ titulo: 'Registrar traslado', mensaje: 'Se moverá existencia física entre ubicaciones y el movimiento quedará registrado en el historial del lote.', confirmar: 'Sí, registrar traslado' }}>
          Guardar traslado
        </BotonEnviar>
      </div>
    </form>
  );
}

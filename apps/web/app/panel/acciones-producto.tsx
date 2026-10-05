import { BotonEnviar, Modal } from '../componentes/interacciones';
import { darBajaProducto, editarProducto } from './acciones-productos-e3';

type ProductoEditable = {
  id: string; codigo: string; nombre: string; familia: string; presentacion: string;
  pesoGramos: number; precioBob: string; activo: boolean;
};

export function AccionesProducto({ producto }: { producto: ProductoEditable }) {
  return (
    <div className="acciones-tabla">
      <Modal boton="Detalles" titulo="Detalle del producto" etiqueta="PRODUCTO" variante="terciaria" icono="historial">
        <dl className="detalle-grid">
          <div><dt>Código</dt><dd><span className="codigo">{producto.codigo}</span></dd></div>
          <div><dt>Estado</dt><dd><span className={producto.activo ? 'badge badge-verde' : 'badge badge-neutro'}>{producto.activo ? 'ACTIVO' : 'INACTIVO'}</span></dd></div>
          <div className="detalle-ancho"><dt>Producto</dt><dd>{producto.nombre}</dd></div>
          <div><dt>Familia</dt><dd>{producto.familia}</dd></div>
          <div><dt>Presentación</dt><dd>{producto.presentacion}</dd></div>
          <div><dt>Peso</dt><dd>{producto.pesoGramos} g</dd></div>
          <div><dt>Precio</dt><dd>Bs {producto.precioBob}</dd></div>
        </dl>
      </Modal>
      {producto.activo && (
        <>
          <Modal boton="Editar" titulo="Editar producto" descripcion="Actualiza los datos comerciales sin modificar el historial de lotes." variante="secundaria" icono={null}>
            <form action={editarProducto} className="formulario formulario-modal">
              <input type="hidden" name="productoId" value={producto.id} />
              <div className="form-grid">
                <label className="campo">Código<input name="codigo" minLength={2} maxLength={40} required defaultValue={producto.codigo} /></label>
                <label className="campo">Nombre<input name="nombre" maxLength={120} required defaultValue={producto.nombre} /></label>
                <label className="campo">Familia<input name="familia" maxLength={70} required defaultValue={producto.familia} /></label>
                <label className="campo">Presentación<input name="presentacion" maxLength={100} required defaultValue={producto.presentacion} /></label>
                <label className="campo">Peso (gramos)<input name="pesoGramos" type="number" min={1} step={1} required defaultValue={producto.pesoGramos} /></label>
                <label className="campo">Precio (Bs)<input name="precioBob" type="number" min={0} step="0.01" required defaultValue={producto.precioBob} /></label>
              </div>
              <div className="modal-acciones"><BotonEnviar pendiente="Guardando…" confirmacion={{ titulo: 'Guardar cambios del producto', mensaje: 'Se actualizarán los datos comerciales del producto. El historial de lotes no se modificará.', confirmar: 'Sí, guardar cambios' }}>Guardar cambios</BotonEnviar></div>
            </form>
          </Modal>
          <form action={darBajaProducto}>
            <input type="hidden" name="productoId" value={producto.id} />
            <BotonEnviar className="boton boton-secundario boton-peligro-suave" pendiente="Procesando…" confirmacion={{ titulo: 'Desactivar producto', mensaje: `¿Confirmas que deseas desactivar “${producto.nombre}”? El registro permanecerá en el historial, pero dejará de estar disponible para nuevas operaciones.`, confirmar: 'Sí, desactivar', variante: 'peligro' }}>Desactivar</BotonEnviar>
          </form>
        </>
      )}
    </div>
  );
}

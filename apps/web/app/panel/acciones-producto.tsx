import { BotonEnviar, Modal } from '../componentes/interacciones';
import { FormularioEditarProducto } from '../componentes/formularios-inventario';
import { darBajaProducto } from './acciones-productos-e3';

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
          <Modal boton="Editar" titulo="Editar producto" descripcion="Actualiza los datos comerciales sin modificar el historial de lotes." variante="secundaria" icono={null} amplio>
            <FormularioEditarProducto producto={producto} />
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

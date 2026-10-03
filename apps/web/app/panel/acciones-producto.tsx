import { BotonEnviar, Modal } from '../componentes/interacciones';
import { darBajaProducto, editarProducto } from './acciones-productos-e3';

type ProductoEditable = {
  id: string;
  codigo: string;
  nombre: string;
  familia: string;
  presentacion: string;
  pesoGramos: number;
  precioBob: string;
  activo: boolean;
};

export function AccionesProducto({ producto }: { producto: ProductoEditable }) {
  if (!producto.activo) {
    return <span className="texto-secundario">Sin acciones</span>;
  }

  return (
    <div className="acciones-tabla">
      <Modal
        boton="Editar"
        titulo="Editar producto"
        descripcion="Actualiza los datos comerciales sin modificar el historial de lotes."
      >
        <form action={editarProducto} className="formulario formulario-modal">
          <input type="hidden" name="productoId" value={producto.id} />
          <div className="form-grid">
            <label className="campo">
              Código
              <input name="codigo" minLength={2} maxLength={40} required defaultValue={producto.codigo} />
            </label>
            <label className="campo">
              Nombre
              <input name="nombre" maxLength={120} required defaultValue={producto.nombre} />
            </label>
            <label className="campo">
              Familia
              <input name="familia" maxLength={70} required defaultValue={producto.familia} />
            </label>
            <label className="campo">
              Presentación
              <input name="presentacion" maxLength={100} required defaultValue={producto.presentacion} />
            </label>
            <label className="campo">
              Peso (gramos)
              <input name="pesoGramos" type="number" min={1} step={1} required defaultValue={producto.pesoGramos} />
            </label>
            <label className="campo">
              Precio (Bs)
              <input name="precioBob" type="number" min={0} step="0.01" required defaultValue={producto.precioBob} />
            </label>
          </div>
          <div className="modal-acciones">
            <BotonEnviar pendiente="Guardando…">Guardar cambios</BotonEnviar>
          </div>
        </form>
      </Modal>

      <form action={darBajaProducto}>
        <input type="hidden" name="productoId" value={producto.id} />
        <BotonEnviar className="boton boton-secundario" pendiente="Procesando…">
          Dar de baja
        </BotonEnviar>
      </form>
    </div>
  );
}

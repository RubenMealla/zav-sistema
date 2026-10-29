"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BotonEnviar } from "../componentes/interacciones";
import { gestion, mensajeError, todasLasPaginas } from "./lib/gestion-cliente";

type Grupo = "familias" | "productos" | "presentaciones";
type Item = {
  id: string;
  nombre: string;
  descripcion?: string;
  caracteristicas?: string;
  familiaId?: string;
  productoComercialId?: string;
  nombreComercial?: string;
  activo: boolean;
  publicado?: boolean;
  orden?: number;
  imagenId?: string | null;
  imagenOriginal?: string | null;
  codigo?: string;
  presentacion?: string;
  tipoEmpaque?: string;
  pesoGramos?: number;
  precioBob?: string;
  validacionComercial?: string;
};
const etiquetas = {
  familias: "Familias",
  productos: "Productos comerciales",
  presentaciones: "Presentaciones / SKU",
};
export function CatalogoPanel() {
  const [grupo, setGrupo] = useState<Grupo>("familias");
  const [items, setItems] = useState<Item[]>([]);
  const [familias, setFamilias] = useState<Item[]>([]);
  const [productos, setProductos] = useState<Item[]>([]);
  const [filtro, setFiltro] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activo, setActivo] = useState("todos");
  const [edicion, setEdicion] = useState<Item | null | undefined>();
  const [familiaFiltro, setFamiliaFiltro] = useState("");
  const [publicado, setPublicado] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const revision = useRef(0);
  const cargar = useCallback(async () => {
    const actual = ++revision.current;
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (activo !== "todos") q.set("activo", activo);
      if (filtro.trim()) q.set("q", filtro.trim());
      if (grupo !== "familias" && familiaFiltro)
        q.set("familiaId", familiaFiltro);
      if (grupo !== "presentaciones" && publicado)
        q.set("publicado", publicado);
      const [r, f, p] = await Promise.all([
        gestion<{ items: Item[]; total: number }>(`catalogo/${grupo}?${q}`),
        todasLasPaginas<Item>("catalogo/familias"),
        todasLasPaginas<Item>("catalogo/productos"),
      ]);
      if (actual !== revision.current) return;
      setError("");
      setItems(r.items);
      setTotal(r.total);
      setFamilias(f);
      setProductos(p);
    } catch (e) {
      if (actual === revision.current) setError(mensajeError(e));
    } finally {
      if (actual === revision.current) setCargando(false);
    }
  }, [grupo, filtro, page, activo, familiaFiltro, publicado]);
  useEffect(() => {
    const t = setTimeout(() => void cargar(), 200);
    return () => {
      clearTimeout(t);
      revision.current++;
    };
  }, [cargar]);
  return (
    <section className="gestion-modulo">
      <nav className="gestion-tabs" aria-label="Catálogo">
        {(Object.keys(etiquetas) as Grupo[]).map((g) => (
          <button
            className={
              grupo === g ? "boton boton-primario" : "boton boton-secundario"
            }
            key={g}
            onClick={() => {
              setGrupo(g);
              setPage(1);
              setEdicion(undefined);
              setMensaje("");
            }}
          >
            {etiquetas[g]}
          </button>
        ))}
      </nav>
      <p>
        Activo habilita operaciones. Publicado controla la landing. La
        disponibilidad depende del inventario. Los valores provisionales
        requieren validación comercial antes de operar.
      </p>
      {error && (
        <p role="alert" className="gestion-error">
          {error}
        </p>
      )}
      {mensaje && (
        <p role="status" className="gestion-exito">
          {mensaje}
        </p>
      )}
      <div className="gestion-barra">
        <label className="campo">
          Buscar
          <input
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value);
              setPage(1);
            }}
            placeholder="Nombre o código"
          />
        </label>
        <label className="campo">
          Estado
          <select
            value={activo}
            onChange={(e) => {
              setActivo(e.target.value);
              setPage(1);
            }}
          >
            <option value="todos">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </label>
        {grupo !== "familias" && (
          <label className="campo">
            Familia
            <select
              value={familiaFiltro}
              onChange={(e) => {
                setFamiliaFiltro(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              {familias.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        {grupo !== "presentaciones" && (
          <label className="campo">
            Publicación
            <select
              value={publicado}
              onChange={(e) => {
                setPublicado(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              <option value="true">Publicados</option>
              <option value="false">Ocultos</option>
            </select>
          </label>
        )}
        <button
          className="boton boton-primario"
          onClick={() => setEdicion(null)}
        >
          Crear{" "}
          {grupo === "familias"
            ? "familia"
            : grupo === "productos"
              ? "producto"
              : "presentación"}
        </button>
      </div>
      {edicion !== undefined && (
        <Editor
          key={`${grupo}-${edicion?.id ?? "nuevo"}`}
          grupo={grupo}
          item={edicion}
          familias={familias}
          productos={productos}
          cerrar={() => setEdicion(undefined)}
          guardado={() => {
            setEdicion(undefined);
            setMensaje("Catálogo actualizado correctamente.");
            void cargar();
          }}
        />
      )}
      <div className="gestion-tabla" aria-busy={cargando}>
        <table>
          <thead>
            <tr>
              <th>
                {grupo === "presentaciones" ? "SKU / Presentación" : "Nombre"}
              </th>
              <th>Relación</th>
              <th>Estado</th>
              <th>
                {grupo === "presentaciones"
                  ? "Precio Bs / Validación"
                  : "Publicación / Orden"}
              </th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <strong>{i.codigo ?? i.nombre}</strong>
                  {grupo === "presentaciones" && (
                    <p>
                      {i.nombreComercial ?? i.nombre} · {i.presentacion}
                    </p>
                  )}
                </td>
                <td>
                  {grupo === "familias"
                    ? `${productos.filter((p) => p.familiaId === i.id).length} productos`
                    : familias.find((f) => f.id === i.familiaId)?.nombre}
                </td>
                <td>{i.activo ? "Activo" : "Inactivo"}</td>
                <td>
                  {grupo === "presentaciones" ? (
                    <>
                      {i.precioBob}
                      <small className="gestion-bloque">
                        {i.validacionComercial === "VALIDADO"
                          ? "Validado"
                          : i.validacionComercial === "LEGADO"
                            ? "Legado: pendiente de revisión"
                            : "PROVISIONAL · no habilitado"}
                      </small>
                    </>
                  ) : (
                    <>
                      {i.publicado ? "Publicado" : "Oculto"} · {i.orden}
                    </>
                  )}
                </td>
                <td>
                  <button
                    className="boton boton-secundario"
                    onClick={() => setEdicion(i)}
                  >
                    Editar
                  </button>
                  {grupo === "familias" && (
                    <button
                      className="boton boton-terciario"
                      onClick={() => {
                        setFamiliaFiltro(i.id);
                        setGrupo("productos");
                        setPage(1);
                      }}
                    >
                      Ver productos
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cargando ? (
        <p role="status">Cargando catálogo…</p>
      ) : (
        items.length === 0 && <p>No hay resultados para estos filtros.</p>
      )}
      <div className="gestion-barra">
        <button
          className="boton boton-secundario"
          disabled={page === 1 || cargando}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </button>
        <span>
          Página {page} · {total} registros
        </span>
        <button
          className="boton boton-secundario"
          disabled={page * 20 >= total || cargando}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}

function Editor({
  grupo,
  item,
  familias,
  productos,
  cerrar,
  guardado,
}: {
  grupo: Grupo;
  item: Item | null;
  familias: Item[];
  productos: Item[];
  cerrar: () => void;
  guardado: () => void;
}) {
  const [familiaId, setFamiliaId] = useState(item?.familiaId ?? "");
  const [productoId, setProductoId] = useState(item?.productoComercialId ?? "");
  const [imagenId, setImagenId] = useState(item?.imagenId ?? null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  async function guardar(form: FormData) {
    setError("");
    const valor = (n: string) => String(form.get(n) ?? "");
    const datos: Record<string, unknown> = {
      activo: form.get("activo") === "on",
    };
    if (grupo === "presentaciones") {
      Object.assign(datos, {
        productoComercialId: productoId,
        codigo: valor("codigo"),
        presentacion: valor("presentacion"),
        tipoEmpaque: valor("tipoEmpaque"),
        pesoGramos: Number(valor("pesoGramos")),
      });
      if (!item || valor("precioBob") !== item.precioBob)
        datos.precioBob = valor("precioBob");
      const validacion = valor("validacionComercial");
      if (validacion !== "LEGADO") datos.validacionComercial = validacion;
    } else {
      Object.assign(datos, {
        nombre: valor("nombre"),
        descripcion: valor("descripcion"),
        orden: Number(valor("orden")),
        publicado: form.get("publicado") === "on",
        imagenId,
      });
      if (grupo === "productos")
        Object.assign(datos, {
          familiaId,
          caracteristicas: valor("caracteristicas"),
        });
    }
    try {
      await gestion(
        `catalogo/${grupo}${item ? "/" + item.id : ""}`,
        item ? "PATCH" : "POST",
        datos,
      );
      guardado();
    } catch (e) {
      setError(mensajeError(e));
    }
  }
  return (
    <section
      className="gestion-editor"
      aria-label={item ? "Editar catálogo" : "Crear catálogo"}
    >
      <div className="gestion-barra">
        <h2>
          {item ? "Editar" : "Crear"} {etiquetas[grupo].toLowerCase()}
        </h2>
        <button className="boton boton-terciario" onClick={cerrar}>
          Cerrar editor
        </button>
      </div>
      <form action={guardar} className="formulario gestion-formulario">
        {grupo !== "familias" && (
          <label className="campo">
            Familia
            <select
              required
              value={familiaId}
              onChange={(e) => {
                setFamiliaId(e.target.value);
                setProductoId("");
              }}
            >
              <option value="">Seleccionar familia</option>
              {familias.map((f) => (
                <option
                  key={f.id}
                  value={f.id}
                  disabled={!f.activo && f.id !== familiaId}
                >
                  {f.nombre}
                  {!f.activo ? " (inactiva)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {grupo === "presentaciones" ? (
          <>
            <label className="campo">
              Producto comercial
              <select
                required
                value={productoId}
                onChange={(e) => setProductoId(e.target.value)}
              >
                <option value="">Seleccionar producto</option>
                {productos
                  .filter((p) => p.familiaId === familiaId)
                  .map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={!p.activo && p.id !== productoId}
                    >
                      {p.nombre}
                    </option>
                  ))}
              </select>
            </label>
            <label className="campo">
              Código SKU
              <input
                name="codigo"
                defaultValue={item?.codigo}
                required
                readOnly={!!item}
                maxLength={40}
                pattern="[A-Za-z0-9][A-Za-z0-9._-]+"
              />
            </label>
            <label className="campo">
              Presentación
              <input
                name="presentacion"
                defaultValue={item?.presentacion}
                required
                maxLength={100}
              />
            </label>
            <label className="campo">
              Tipo de empaque
              <input
                name="tipoEmpaque"
                defaultValue={item?.tipoEmpaque}
                required
                maxLength={100}
              />
            </label>
            <label className="campo">
              Peso (gramos)
              <input
                name="pesoGramos"
                type="number"
                min="1"
                step="1"
                defaultValue={item?.pesoGramos}
                required
              />
            </label>
            <label className="campo">
              Precio (Bs)
              <input
                name="precioBob"
                inputMode="decimal"
                pattern="[0-9]{1,10}([.][0-9]{1,2})?"
                defaultValue={item?.precioBob}
                required
              />
            </label>
            <label className="campo">
              Validación comercial
              <select
                name="validacionComercial"
                defaultValue={item?.validacionComercial ?? "PROVISIONAL"}
              >
                {item?.validacionComercial === "LEGADO" && (
                  <option value="LEGADO">
                    Legado: conservar pendiente de revisión
                  </option>
                )}
                <option value="PROVISIONAL">
                  Provisional · no usar en operaciones
                </option>
                <option value="VALIDADO">
                  Validado comercialmente por el Administrador
                </option>
              </select>
            </label>
            <p className="gestion-ancho">
              Si existe historial, los cambios de identidad requieren otro SKU.
              Cambiar un precio sin validarlo lo deja provisional.
            </p>
          </>
        ) : (
          <>
            <label className="campo">
              Nombre
              <input
                name="nombre"
                defaultValue={item?.nombre}
                required
                maxLength={grupo === "familias" ? 70 : 120}
              />
            </label>
            <label className="campo gestion-ancho">
              Descripción
              <textarea
                name="descripcion"
                defaultValue={item?.descripcion}
                maxLength={1500}
              />
            </label>
            {grupo === "productos" && (
              <label className="campo gestion-ancho">
                Características
                <textarea
                  name="caracteristicas"
                  defaultValue={item?.caracteristicas}
                  maxLength={2000}
                />
              </label>
            )}
            <label className="campo">
              Orden de visualización
              <input
                name="orden"
                type="number"
                min="0"
                max="100000"
                defaultValue={item?.orden ?? 0}
              />
            </label>
            <label className="campo">
              Fotografía · PNG, JPEG o WebP hasta 5 MB
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={subiendo}
                onChange={async (e) => {
                  const archivo = e.target.files?.[0];
                  if (!archivo) return;
                  if (archivo.size > 5 * 1024 * 1024) {
                    setError("La fotografía supera 5 MB.");
                    return;
                  }
                  setSubiendo(true);
                  setError("");
                  try {
                    const form = new FormData();
                    form.append("archivo", archivo);
                    const i = await gestion<{ id: string }>(
                      "catalogo/imagenes",
                      "POST",
                      form,
                    );
                    setImagenId(i.id);
                  } catch (err) {
                    setError(mensajeError(err));
                  } finally {
                    setSubiendo(false);
                  }
                }}
              />
            </label>
            {(imagenId || item?.imagenOriginal) && (
              <img
                className="gestion-foto"
                src={
                  imagenId
                    ? `/api/gestion/catalogo/imagenes/${imagenId}`
                    : (item?.imagenOriginal ?? "")
                }
                alt="Vista previa de la fotografía"
              />
            )}
            {subiendo && <p role="status">Validando fotografía…</p>}
            <label className="gestion-check">
              <input
                name="publicado"
                type="checkbox"
                defaultChecked={item?.publicado ?? false}
              />{" "}
              Publicado en la landing
            </label>
          </>
        )}
        <label className="gestion-check">
          <input
            name="activo"
            type="checkbox"
            defaultChecked={item?.activo ?? true}
          />{" "}
          Activo para operaciones
        </label>
        {error && (
          <p className="gestion-error gestion-ancho" role="alert">
            {error}
          </p>
        )}
        <div className="gestion-ancho">
          <BotonEnviar
            disabled={subiendo}
            confirmacion={{
              titulo: "Guardar catálogo",
              mensaje:
                "Confirma los datos y el estado comercial. La publicación actualizará el catálogo público.",
              confirmar: "Guardar cambios",
            }}
          >
            Guardar cambios
          </BotonEnviar>
        </div>
      </form>
    </section>
  );
}

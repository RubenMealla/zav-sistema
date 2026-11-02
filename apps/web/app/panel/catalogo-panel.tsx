"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BotonEnviar } from "../componentes/interacciones";
import Image from "next/image";
import { Ventana } from "../componentes/ventana";
import { Icono } from "../componentes/icono";
import { FamiliaIcono } from "../componentes/familia-icono";
import {
  manejarInvalido,
  limpiarInvalido,
  PATRON_CODIGO_SKU,
  PATRON_NOMBRE,
  PATRON_TEXTO_REQUERIDO,
} from "../componentes/validacion-formularios";
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
  productos: "Productos",
  presentaciones: "Presentaciones",
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
  const [referencias, setReferencias] = useState(0);
  useEffect(() => {
    let vigente = true;
    Promise.all([
      todasLasPaginas<Item>("catalogo/familias"),
      todasLasPaginas<Item>("catalogo/productos"),
    ])
      .then(([f, p]) => {
        if (vigente) {
          setFamilias(f);
          setProductos(p);
        }
      })
      .catch((e) => {
        if (vigente) setError(mensajeError(e));
      });
    return () => {
      vigente = false;
    };
  }, [referencias]);
  function cambiarGrupo(g: Grupo, familia = "") {
    revision.current++;
    setCargando(true);
    setItems([]);
    setTotal(0);
    setGrupo(g);
    setFamiliaFiltro(familia);
    setFiltro("");
    setPublicado("");
    setActivo("todos");
    setPage(1);
    setEdicion(undefined);
    setMensaje("");
  }
  const cargar = useCallback(async () => {
    const actual = ++revision.current;
    setCargando(true);
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
      const r = await gestion<{ items: Item[]; total: number }>(
        `catalogo/${grupo}?${q}`,
      );
      if (actual !== revision.current) return;
      setError("");
      setItems(r.items);
      setTotal(r.total);
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
              if (g === grupo) return;
              cambiarGrupo(g);
            }}
          >
            {etiquetas[g]}
          </button>
        ))}
      </nav>
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
      <div className="gestion-barra gestion-filtros">
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
          disabled={cargando}
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
        <Ventana
          titulo={`${edicion ? "Editar" : "Crear"} ${grupo === "familias" ? "familia" : grupo === "productos" ? "producto" : "presentación"}`}
          etiqueta="CATÁLOGO"
          amplia
          cerrar={() => setEdicion(undefined)}
        >
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
              setReferencias((n) => n + 1);
              void cargar();
            }}
          />
        </Ventana>
      )}
      <div className="gestion-tabla" aria-busy={cargando}>
        <table>
          <thead>
            <tr>
              <th>
                {grupo === "presentaciones"
                  ? "Producto / Presentación"
                  : "Nombre"}
              </th>
              <th>Relación</th>
              <th>Estado</th>
              <th>
                {grupo === "presentaciones"
                  ? "Precio Bs"
                  : "Publicación / Orden"}
              </th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={5}>
                  <div className="gestion-cargando" role="status">
                    Cargando {etiquetas[grupo].toLowerCase()}…
                  </div>
                </td>
              </tr>
            ) : (
              items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <div className="catalogo-celda">
                      <Miniatura
                        familia={grupo === "familias"}
                        item={
                          grupo === "presentaciones"
                            ? productos.find(
                                (p) => p.id === i.productoComercialId,
                              )
                            : i
                        }
                      />
                      <div>
                        <strong>{i.nombreComercial ?? i.nombre}</strong>
                        {grupo === "presentaciones" && (
                          <p>
                            {i.presentacion}
                            <small className="gestion-bloque">{i.codigo}</small>
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    {grupo === "familias"
                      ? `${productos.filter((p) => p.familiaId === i.id).length} productos`
                      : familias.find(
                          (f) =>
                            f.id ===
                            (i.familiaId ??
                              productos.find(
                                (p) => p.id === i.productoComercialId,
                              )?.familiaId),
                        )?.nombre}
                  </td>
                  <td>
                    <span
                      className={`gestion-estado ${i.activo ? "estado-verde" : "estado-gris"}`}
                    >
                      {i.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    {grupo === "presentaciones" ? (
                      <>
                        {i.precioBob}
                        <small className="gestion-bloque">
                          {i.validacionComercial === "VALIDADO"
                            ? "Listo para venta"
                            : i.validacionComercial === "LEGADO"
                              ? "Pendiente de revisión"
                              : "Precio por confirmar"}
                        </small>
                      </>
                    ) : (
                      <>
                        {i.publicado ? "Visible en web" : "Oculto"} · {i.orden}
                      </>
                    )}
                  </td>
                  <td>
                    <button
                      className="boton boton-secundario"
                      disabled={cargando}
                      onClick={() => setEdicion(i)}
                    >
                      Editar
                    </button>
                    {grupo === "familias" && (
                      <button
                        className="boton boton-terciario"
                        onClick={() => {
                          cambiarGrupo("productos", i.id);
                        }}
                      >
                        Ver productos
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!cargando && items.length === 0 && (
        <p>No hay resultados para estos filtros.</p>
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

function Miniatura({ item, familia }: { item?: Item; familia?: boolean }) {
  const src = item?.imagenId
    ? `/api/gestion/catalogo/imagenes/${item.imagenId}`
    : item?.imagenOriginal;
  return (
    <span className="catalogo-miniatura">
      {familia && !item?.imagenId ? (
        <FamiliaIcono nombre={item?.nombre ?? ""} />
      ) : src ? (
        <Image
          src={src}
          alt=""
          width={52}
          height={52}
          sizes="52px"
          unoptimized={src.startsWith("/api/")}
        />
      ) : (
        <Icono nombre="producto" tamano={24} />
      )}
    </span>
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
      className="catalogo-editor"
      aria-label={item ? "Editar catálogo" : "Crear catálogo"}
    >
      <form
        action={guardar}
        className="formulario gestion-formulario"
        onInvalid={manejarInvalido}
        onInput={limpiarInvalido}
        onChange={limpiarInvalido}
      >
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
                disabled={!familiaId}
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
                aria-label="Código SKU"
                defaultValue={item?.codigo}
                required
                readOnly={!!item}
                minLength={2}
                maxLength={40}
                pattern={PATRON_CODIGO_SKU}
                data-validacion="Usa de 2 a 40 letras, números, puntos, guiones o guiones bajos. Empieza con una letra o un número."
                onBlur={(e) => {
                  e.currentTarget.value = e.currentTarget.value
                    .trim()
                    .toUpperCase();
                }}
              />
              <small>Único y permanente. Ejemplo: CH-PARR-500.</small>
            </label>
            <label className="campo">
              Presentación
              <input
                name="presentacion"
                defaultValue={item?.presentacion}
                required
                maxLength={100}
                pattern={PATRON_TEXTO_REQUERIDO}
                data-validacion="Describe la presentación; no uses solamente espacios."
              />
            </label>
            <label className="campo">
              Tipo de empaque
              <input
                name="tipoEmpaque"
                defaultValue={item?.tipoEmpaque}
                required
                maxLength={100}
                pattern={PATRON_TEXTO_REQUERIDO}
                data-validacion="Indica el tipo de empaque; no uses solamente espacios."
              />
            </label>
            <label className="campo">
              Peso (gramos)
              <input
                name="pesoGramos"
                type="number"
                min="1"
                max="2147483647"
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
                maxLength={13}
                data-validacion="Ingresa un precio no negativo con punto decimal y hasta dos decimales. Ejemplo: 27.50."
                defaultValue={item?.precioBob}
                required
              />
            </label>
            <label className="campo">
              Precio y presentación
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
                  Por confirmar · aún no se puede vender
                </option>
                <option value="VALIDADO">
                  Confirmados · habilitar para venta
                </option>
              </select>
            </label>
            <small className="gestion-ancho">
              Confirma el precio y la presentación antes de habilitarlos para
              venta.
            </small>
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
                pattern={PATRON_NOMBRE}
                data-validacion="El nombre debe contener letras; no admite etiquetas ni caracteres de control o invisibles."
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
                  if (
                    !["image/png", "image/jpeg", "image/webp"].includes(
                      archivo.type,
                    ) ||
                    archivo.size === 0 ||
                    archivo.size > 5 * 1024 * 1024
                  ) {
                    setError(
                      "Selecciona una fotografía PNG, JPEG o WebP de hasta 5 MB que no esté vacía.",
                    );
                    e.target.value = "";
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
              <Image
                className="gestion-foto"
                width={160}
                height={110}
                sizes="160px"
                unoptimized={!!imagenId}
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
              Mostrar en la web
            </label>
          </>
        )}
        <label className="gestion-check">
          <input
            name="activo"
            type="checkbox"
            defaultChecked={item?.activo ?? true}
          />{" "}
          Activo
        </label>
        {error && (
          <p className="gestion-error gestion-ancho" role="alert">
            {error}
          </p>
        )}
        <div className="gestion-ancho">
          <button
            type="button"
            className="boton boton-terciario"
            onClick={cerrar}
          >
            Cancelar
          </button>
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

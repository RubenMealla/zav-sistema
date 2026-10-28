export type ProductoPublico = {
  id: string;
  nombre: string;
  imagen: string | null;
  descripcion: string;
  caracteristicas: string;
};
export type FamiliaPublica = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  imagen: string | null;
  productos: ProductoPublico[];
};
export function imagenPublica(ruta: string | null): string | null {
  return ruta?.startsWith("/api/v1/publico/catalogo/imagenes/")
    ? ruta.replace(
        "/api/v1/publico/catalogo/imagenes/",
        "/api/catalogo/imagenes/",
      )
    : ruta;
}

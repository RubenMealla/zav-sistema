import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { guardarCatalogo } from "./soporte-catalogo";
const API = "http://127.0.0.1:3001";
async function login(request: APIRequestContext, rol = "ADMIN") {
  const r = await request.post(`${API}/api/v1/auth/login`, {
    data: {
      identificador: process.env[`QA_${rol}_IDENTIFICADOR`],
      contrasena: process.env[`QA_${rol}_PASSWORD`],
    },
  });
  expect(r.status()).toBe(200);
  return r.json();
}
async function entrar(page: Page, token: string) {
  await page.context().addCookies([
    {
      name: "zav_acceso",
      value: token,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
test("publicación dinámica, alta relacional y ocultación sin reconstruir landing", async ({
  page,
  request,
}) => {
  const sesion = await login(request);
  await entrar(page, sesion.accessToken);
  const nombre = `Familia Web QA ${Date.now()}`;
  await page.goto("/panel?vista=catalogo");
  await page.getByRole("button", { name: "Crear familia" }).click();
  let editor = page.getByRole("region", { name: "Crear catálogo" });
  await editor.getByLabel("Nombre", { exact: true }).fill(nombre);
  await editor
    .getByLabel("Descripción")
    .fill("Familia sintética de ensayo web");
  await editor.getByLabel("Mostrar en la web").check();
  await guardarCatalogo(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: nombre, exact: true }),
  ).toBeVisible();
  await page.goto("/panel?vista=catalogo");
  await page.getByLabel("Buscar", { exact: true }).fill(nombre);
  await page
    .getByRole("row")
    .filter({ hasText: nombre })
    .getByRole("button", { name: "Editar", exact: true })
    .click();
  editor = page.getByRole("region", { name: "Editar catálogo" });
  await editor.getByLabel("Mostrar en la web").uncheck();
  await guardarCatalogo(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: nombre, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "7 familias de productos ZAV." }),
  ).toBeVisible();
});
test("venta directa web, respuesta perdida, reintento y carga a Vendedor", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const sesion = await login(request),
    vendedor = await login(request, "VENDEDOR");
  await entrar(page, sesion.accessToken);
  const headers = { Authorization: `Bearer ${sesion.accessToken}` };
  const post = async (ruta: string, data: unknown) => {
    const r = await request.post(API + "/api/v1/" + ruta, { headers, data });
    expect(r.status(), await r.text()).toBe(201);
    return r.json();
  };
  const codigo = `WEB-VD-${Date.now()}`;
  const p = await post("productos", {
    codigo,
    nombre: codigo,
    familia: "QA WEB",
    presentacion: "Paquete 500g QA",
    pesoGramos: 500,
    precioBob: "30.00",
    validacionComercial: "VALIDADO",
  });
  const fecha = (dias: number) =>
    new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
  const l = await post("lotes", {
    operacionClave: randomUUID(),
    productoId: p.id,
    codigo: `L-${codigo}`,
    elaboradoEl: fecha(-1),
    venceEl: fecha(30),
    cantidadInicial: 12,
    ubicacionCodigo: "PRODUCCION_ALMACENAMIENTO",
  });
  await post(`lotes/${l.id}/liberar`, {
    operacionClave: randomUUID(),
    motivo: "QA web",
  });
  await post("movimientos/traslado", {
    operacionClave: randomUUID(),
    loteId: l.id,
    origenCodigo: "PRODUCCION_ALMACENAMIENTO",
    destinoCodigo: "VENTA_DESPACHO",
    cantidad: 12,
  });
  const despacho = await request.get(
    `${API}/api/v1/ubicaciones/venta-despacho`,
    { headers },
  );
  const ubicacion = await despacho.json();
  const configurada = await request.patch(
    `${API}/api/v1/ubicaciones/${ubicacion.id}/georreferencia`,
    { headers, data: { latitud: -21.53, longitud: -64.73 } },
  );
  expect(configurada.status()).toBe(200);
  await page.goto("/panel?vista=venta-directa");
  await expect(
    page.getByRole("heading", { name: "Historial", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Detalle de operación" }),
  ).toHaveCount(0);
  await page.getByLabel("Buscar producto o presentación").fill(codigo);
  const cantidad = page.getByLabel(`Cantidad ${codigo}`, { exact: true });
  await cantidad.pressSequentially("-3");
  await expect(cantidad).toHaveValue("-3");
  await expect(
    page.getByRole("alert").filter({ hasText: "unidades enteras" }),
  ).toBeVisible();
  await cantidad.fill("1e1");
  await expect(cantidad).toHaveValue("1e1");
  await expect(
    page.getByRole("button", { name: "Confirmar entrega", exact: true }),
  ).toBeDisabled();
  await page.getByLabel(`Cantidad ${codigo}`, { exact: true }).fill("1.5");
  await expect(
    page.getByRole("alert").filter({ hasText: "unidades enteras" }),
  ).toBeVisible();
  await page
    .getByLabel("Buscar producto o presentación")
    .fill("no-coincide-con-productos");
  await expect(
    page.getByRole("alert").filter({ hasText: "unidades enteras" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar entrega", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Buscar producto o presentación").fill(codigo);
  await page.getByLabel(`Cantidad ${codigo}`, { exact: true }).fill("13");
  await expect(
    page.getByRole("alert").filter({ hasText: "12 unidades libres" }),
  ).toBeVisible();
  await page.getByLabel(`Cantidad ${codigo}`, { exact: true }).fill("3");
  let clave = "";
  let llamadas = 0;
  await page.route(
    "**/api/gestion/operaciones/salidas-directas",
    async (route) => {
      llamadas++;
      const cuerpo = route.request().postDataJSON();
      if (clave) expect(cuerpo.operacionClave).toBe(clave);
      else clave = cuerpo.operacionClave;
      if (llamadas === 1) {
        const r = await route.fetch();
        expect(r.status()).toBe(201);
        await route.abort("failed");
      } else await route.continue();
    },
  );
  await page
    .getByRole("button", { name: "Confirmar entrega", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Operación pendiente de verificar" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Venta registrada correctamente." }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Verificar / reintentar" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Venta registrada correctamente." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Historial", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Historial", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Buscar producto o presentación")).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Ver detalle", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Detalle de operación" }),
  ).toContainText(codigo);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(llamadas).toBe(2);
  const saldos = await request.get(`${API}/api/v1/operaciones/disponibilidad`, {
    headers,
  });
  expect(
    (await saldos.json()).items.find(
      (x: { productoId: string }) => x.productoId === p.id,
    ).cantidadDisponible,
  ).toBe(9);
  await page.screenshot({
    path: "test-results/venta-directa-confirmada.png",
    fullPage: true,
  });
  await page.goto("/panel?vista=custodia");
  await page
    .getByLabel("Vendedor destinatario")
    .selectOption(vendedor.usuario.id);
  await page.getByLabel("Buscar producto o presentación").fill(codigo);
  await page.getByLabel(`Cantidad ${codigo}`, { exact: true }).fill("4");
  await page
    .getByRole("button", { name: "Registrar carga", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Carga registrada." }),
  ).toBeVisible();
  await page
    .getByRole("status")
    .getByRole("button", { name: "Ver detalle" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Detalle de operación" }),
  ).toContainText("Por recibir");
  await page.getByRole("button", { name: "Cerrar ventana" }).click();
  const cargas = await request.get(`${API}/api/v1/operaciones?tipo=CARGA`, {
    headers: { Authorization: `Bearer ${vendedor.accessToken}` },
  });
  const carga = (await cargas.json()).items[0];
  const recibida = await request.post(
    `${API}/api/v1/operaciones/${carga.id}/recepcion`,
    {
      headers: { Authorization: `Bearer ${vendedor.accessToken}` },
      data: { operacionClave: randomUUID() },
    },
  );
  expect(recibida.status()).toBe(201);
  await page
    .getByRole("button", { name: "Mercancía por vendedor", exact: true })
    .click();
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await page.screenshot({
    path: "test-results/custodia-vendedor.png",
    fullPage: true,
  });
});

test("el catálogo cambia de tabla sin mostrar filas anteriores y edita en modal", async ({
  page,
  request,
}) => {
  const sesion = await login(request);
  await entrar(page, sesion.accessToken);
  await page.goto("/panel?vista=catalogo");
  const familia = page.getByRole("row").filter({ hasText: "Chorizos" });
  await expect(familia).toBeVisible();
  const llamada = page.waitForRequest(
    (r) =>
      r.url().includes("/api/gestion/catalogo/productos?") &&
      r.url().includes("limit=20"),
  );
  let continuar!: () => void;
  const espera = new Promise<void>((resolve) => {
    continuar = resolve;
  });
  await page.route("**/api/gestion/catalogo/productos?*", async (route) => {
    if (route.request().url().includes("limit=20")) await espera;
    await route.continue();
  });
  await familia.getByRole("button", { name: "Ver productos" }).click();
  await llamada;
  await expect(page.getByRole("button", { name: "Ver productos" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Cargando productos" }),
  ).toBeVisible();
  continuar();
  const producto = page
    .getByRole("row")
    .filter({ hasText: "Chorizo Parrillero" });
  await expect(producto).toBeVisible();
  await expect(producto.locator("img")).toBeVisible();
  await producto.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Editar producto" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar ventana" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    producto.getByRole("button", { name: "Editar", exact: true }),
  ).toBeFocused();
});
test("proxy de gestión rechaza escritura desde otro origen", async ({
  request,
  page,
}) => {
  const sesion = await login(request);
  await entrar(page, sesion.accessToken);
  const r = await page.request.post("/api/gestion/catalogo/familias", {
    headers: { Origin: "https://otro-origen.example" },
    data: { nombre: "No crear" },
  });
  expect(r.status()).toBe(403);
});

test("formularios rechazan nombres, códigos y precios inválidos y reinician selectores dependientes", async ({
  page,
  request,
}) => {
  const sesion = await login(request);
  await entrar(page, sesion.accessToken);
  await page.goto("/panel?vista=catalogo");
  await page
    .getByRole("button", { name: "Crear familia", exact: true })
    .click();
  let editor = page.getByRole("region", { name: "Crear catálogo" });
  for (const nombre of [
    "   ",
    "12345",
    "---",
    "Jamón\u200bQA",
    "<b>Jamón</b>",
  ]) {
    await editor.getByLabel("Nombre", { exact: true }).fill(nombre);
    await editor.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(
      await editor
        .locator("form")
        .evaluate((e) => (e as HTMLFormElement).checkValidity()),
    ).toBe(false);
  }
  await editor
    .getByLabel("Nombre", { exact: true })
    .fill("Jamón artesanal ZAV 2026");
  expect(
    await editor
      .locator("form")
      .evaluate((e) => (e as HTMLFormElement).checkValidity()),
  ).toBe(true);
  await editor.getByRole("button", { name: "Cancelar" }).click();
  await page
    .getByRole("button", { name: "Presentaciones", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Crear presentación", exact: true })
    .click();
  editor = page.getByRole("region", { name: "Crear catálogo" });
  const familia = editor.getByRole("combobox", {
    name: "Familia",
    exact: true,
  });
  const producto = editor.getByRole("combobox", {
    name: "Producto comercial",
    exact: true,
  });
  await expect(producto).toBeDisabled();
  await familia.selectOption({ label: "Chorizos" });
  await producto.selectOption({ label: "Chorizo Parrillero" });
  await familia.selectOption({ label: "Salchichas" });
  await expect(producto).toHaveValue("");
  await expect(
    producto.getByRole("option", { name: "Chorizo Parrillero" }),
  ).toHaveCount(0);
  await producto.selectOption({ label: "Salchicha Tipo Viena" });
  await editor
    .getByLabel("Presentación", { exact: true })
    .fill("Paquete 500 g");
  await editor.getByLabel("Tipo de empaque", { exact: true }).fill("Bolsa");
  await editor.getByLabel("Peso (gramos)", { exact: true }).fill("500");
  await editor.getByLabel("Precio (Bs)", { exact: true }).fill("27.50");
  for (const codigo of ["NO VALIDO", "_SKU", "A", "SKU/QA", "SKU@QA"]) {
    await editor.getByLabel("Código SKU", { exact: true }).fill(codigo);
    await editor.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(
      await editor
        .locator("form")
        .evaluate((e) => (e as HTMLFormElement).checkValidity()),
    ).toBe(false);
  }
  await editor.getByLabel("Código SKU", { exact: true }).fill("ZAV-500.QA_01");
  for (const precio of ["-2", "2.345", "dos"]) {
    await editor.getByLabel("Precio (Bs)", { exact: true }).fill(precio);
    expect(
      await editor
        .locator("form")
        .evaluate((e) => (e as HTMLFormElement).checkValidity()),
    ).toBe(false);
  }
  await editor.getByLabel("Precio (Bs)", { exact: true }).fill("27.50");
  expect(
    await editor
      .locator("form")
      .evaluate((e) => (e as HTMLFormElement).checkValidity()),
  ).toBe(true);
});

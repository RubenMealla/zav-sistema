import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('Catálogo relacional y publicación (PostgreSQL real)', () => {
  let app: INestApplication<App>;
  let db: pg.Pool;
  let admin: string;
  let vendedor: string;
  let familiaId: string;
  let comercialId: string;
  let skuId: string;
  let imagenId: string;
  const sufijo = randomUUID().slice(0, 8);
  const auth = () => ({ Authorization: `Bearer ${admin}` });

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const login = async (rol: string) =>
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            identificador: process.env[`QA_${rol}_IDENTIFICADOR`],
            contrasena: process.env[`QA_${rol}_PASSWORD`],
          })
          .expect(200)
      ).body.accessToken as string;
    admin = await login('ADMIN');
    vendedor = await login('VENDEDOR');
  });
  afterAll(async () => {
    await db?.end();
    await app?.close();
  });

  it('publica exactamente las siete familias y trece productos confirmados, sin stock ni precios', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/v1/publico/catalogo')
      .expect(200);
    expect(body.familias).toHaveLength(7);
    const productos = body.familias.flatMap(
      (f: { productos: unknown[] }) => f.productos,
    );
    expect(productos).toHaveLength(13);
    expect(productos.map((p: { nombre: string }) => p.nombre)).toContain(
      'Queso de Chancho',
    );
    expect(JSON.stringify(body)).not.toMatch(
      /precio|cantidad|usuario|contrasena|lote/i,
    );
  });

  it('protege todo el CRUD y la carga de fotografías con JWT y rol', async () => {
    for (const ruta of [
      'familias',
      'productos',
      'presentaciones',
      'imagenes',
    ]) {
      await request(app.getHttpServer())
        .post(`/api/v1/catalogo/${ruta}`)
        .send({})
        .expect(401);
      await request(app.getHttpServer())
        .post(`/api/v1/catalogo/${ruta}`)
        .set('Authorization', `Bearer ${vendedor}`)
        .send({})
        .expect(403);
    }
  });

  it('normaliza duplicados, permite editar y filtrar familias', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/catalogo/familias')
      .set(auth())
      .send({
        nombre: `Familia Ágil ${sufijo}`,
        descripcion: 'Prueba sintética',
        orden: 20,
      })
      .expect(201);
    familiaId = body.id;
    await request(app.getHttpServer())
      .post('/api/v1/catalogo/familias')
      .set(auth())
      .send({ nombre: `  FAMILIA   agil ${sufijo} ` })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/catalogo/familias/${familiaId}`)
      .set(auth())
      .send({ descripcion: 'Editada', publicado: true })
      .expect(200);
    const listado = await request(app.getHttpServer())
      .get(`/api/v1/catalogo/familias?q=${sufijo}&publicado=true`)
      .set(auth())
      .expect(200);
    expect(listado.body.items[0].descripcion).toBe('Editada');
    expect(listado.body.total).toBe(1);
  });

  it('asocia producto y presentación, preserva precisión decimal y diferencia provisional', async () => {
    const comercial = await request(app.getHttpServer())
      .post('/api/v1/catalogo/productos')
      .set(auth())
      .send({
        familiaId,
        nombre: `Producto QA ${sufijo}`,
        caracteristicas: 'Solo QA',
        publicado: true,
      })
      .expect(201);
    comercialId = comercial.body.id;
    await request(app.getHttpServer())
      .post('/api/v1/catalogo/productos')
      .set(auth())
      .send({ familiaId: randomUUID(), nombre: 'Relación inválida' })
      .expect(409);
    const datos = {
      productoComercialId: comercialId,
      codigo: `QA-CAT-${sufijo}`,
      presentacion: 'Paquete de prueba',
      tipoEmpaque: 'Bolsa QA',
      pesoGramos: 500,
      precioBob: '9999999999.99',
    };
    const sku = await request(app.getHttpServer())
      .post('/api/v1/catalogo/presentaciones')
      .set(auth())
      .send(datos)
      .expect(201);
    skuId = sku.body.id;
    expect(sku.body.precioBob).toBe('9999999999.99');
    expect(sku.body.validacionComercial).toBe('PROVISIONAL');
    await request(app.getHttpServer())
      .post('/api/v1/catalogo/presentaciones')
      .set(auth())
      .send(datos)
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/catalogo/presentaciones/${skuId}`)
      .set(auth())
      .send({ precioBob: '27.30', validacionComercial: 'VALIDADO' })
      .expect(200);
    const resultado = await request(app.getHttpServer())
      .get(
        `/api/v1/catalogo/presentaciones?productoComercialId=${comercialId}&q=QA-CAT`,
      )
      .set(auth())
      .expect(200);
    expect(resultado.body.items[0].precioBob).toBe('27.30');
    expect(resultado.body.items[0].validadoPor).toBeTruthy();
  });

  it('conserva identidad de SKU usado y precio del pedido al cambiar el precio actual', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set(auth())
      .send({
        operacionClave: randomUUID(),
        productoId: skuId,
        codigo: `QA-CATL-${sufijo}`,
        elaboradoEl: '2026-01-01',
        venceEl: '2099-01-01',
        cantidadInicial: 10,
        ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
      })
      .expect(201);
    const cliente = await db.query(
      "INSERT INTO cliente(nombre,direccion) VALUES ('Cliente sintético catálogo','Dirección QA') RETURNING id",
    );
    const usuario = await db.query(
      'SELECT id FROM usuario WHERE identificador=$1',
      [process.env.QA_VENDEDOR_IDENTIFICADOR],
    );
    const pedido = await db.query(
      "INSERT INTO pedido(cliente_id,vendedor_id,direccion_entrega) VALUES ($1,$2,'Dirección QA') RETURNING id",
      [cliente.rows[0].id, usuario.rows[0].id],
    );
    await db.query(
      'INSERT INTO detalle_pedido(pedido_id,producto_id,cantidad,precio_unitario_bob) VALUES ($1,$2,1,27.30)',
      [pedido.rows[0].id, skuId],
    );
    await request(app.getHttpServer())
      .patch(`/api/v1/catalogo/presentaciones/${skuId}`)
      .set(auth())
      .send({ pesoGramos: 900 })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/catalogo/presentaciones/${skuId}`)
      .set(auth())
      .send({ codigo: 'OTRO-CODIGO' })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/catalogo/presentaciones/${skuId}`)
      .set(auth())
      .send({ precioBob: '31.90', validacionComercial: 'VALIDADO' })
      .expect(200);
    const historico = await db.query(
      'SELECT precio_unitario_bob FROM detalle_pedido WHERE pedido_id=$1',
      [pedido.rows[0].id],
    );
    expect(historico.rows[0].precio_unitario_bob).toBe('27.30');
  });

  it('valida contenido de imágenes y las sirve solo cuando existe publicación autorizada', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/catalogo/imagenes')
      .set(auth())
      .attach('archivo', Buffer.from('<script>alert(1)</script>'), {
        filename: 'falsa.png',
        contentType: 'image/png',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/catalogo/imagenes')
      .set(auth())
      .attach('archivo', Buffer.from('<svg/>'), {
        filename: 'vector.svg',
        contentType: 'image/svg+xml',
      })
      .expect(415);
    const png = await sharp({
      create: { width: 8, height: 8, channels: 4, background: '#ab1020' },
    })
      .png()
      .toBuffer();
    const subida = await request(app.getHttpServer())
      .post('/api/v1/catalogo/imagenes')
      .set(auth())
      .attach('archivo', png, { filename: 'qa.png', contentType: 'image/png' })
      .expect(201);
    imagenId = subida.body.id;
    await request(app.getHttpServer())
      .get(`/api/v1/publico/catalogo/imagenes/${imagenId}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/catalogo/productos/${comercialId}`)
      .set(auth())
      .send({ imagenId })
      .expect(200);
    const imagen = await request(app.getHttpServer())
      .get(`/api/v1/publico/catalogo/imagenes/${imagenId}`)
      .expect(200);
    expect(imagen.headers['content-type']).toContain('image/png');
    expect(imagen.headers['cache-control']).toBe('no-store');
    await request(app.getHttpServer())
      .patch(`/api/v1/catalogo/familias/${familiaId}`)
      .set(auth())
      .send({ publicado: false })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/publico/catalogo/imagenes/${imagenId}`)
      .expect(404);
    const publico = await request(app.getHttpServer())
      .get('/api/v1/publico/catalogo')
      .expect(200);
    expect(
      publico.body.familias.some((f: { id: string }) => f.id === familiaId),
    ).toBe(false);
  });

  it('baja lógica preserva relaciones y deja auditoría atribuida', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/catalogo/presentaciones/${skuId}`)
      .set(auth())
      .send({ activo: false })
      .expect(200);
    const registro = await request(app.getHttpServer())
      .get(`/api/v1/catalogo/presentaciones/${skuId}`)
      .set(auth())
      .expect(200);
    expect(registro.body.activo).toBe(false);
    const auditoria = await db.query(
      'SELECT count(*)::int AS total FROM catalogo_auditoria WHERE entidad_id=$1 AND usuario_id IS NOT NULL',
      [skuId],
    );
    expect(auditoria.rows[0].total).toBeGreaterThanOrEqual(4);
  });
});

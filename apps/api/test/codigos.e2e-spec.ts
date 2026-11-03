import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('Códigos sugeridos, unicidad y compatibilidad', () => {
  let app: INestApplication<App>;
  let admin: string, vendedor: string, familiaId: string, productoId: string;
  const auth = () => ({ Authorization: `Bearer ${admin}` });
  const api = () => request(app.getHttpServer());
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    await app.init();
    for (const rol of ['ADMIN', 'VENDEDOR']) {
      const r = await api().post('/api/v1/auth/login').send({ identificador: process.env[`QA_${rol}_IDENTIFICADOR`], contrasena: process.env[`QA_${rol}_PASSWORD`] }).expect(200);
      if (rol === 'ADMIN') admin = r.body.accessToken as string;
      else vendedor = r.body.accessToken as string;
    }
    const f = await api().post('/api/v1/catalogo/familias').set(auth()).send({ nombre: `Serie QA ${randomUUID().slice(0, 8)}` }).expect(201);
    familiaId = f.body.id;
    const p = await api().post('/api/v1/catalogo/productos').set(auth()).send({ familiaId, nombre: 'Producto de ensayo de códigos' }).expect(201);
    productoId = p.body.id;
  });
  afterAll(async () => { await app?.close(); });
  const sugerir = () => api().get(`/api/v1/codigos/producto?familiaId=${familiaId}`).set(auth());
  const crear = (codigo: string) => api().post('/api/v1/catalogo/presentaciones').set(auth()).send({ productoComercialId: productoId, codigo, presentacion: 'Unidad QA', tipoEmpaque: 'Bolsa', pesoGramos: 100, precioBob: '10.00' });

  it('requiere administrador y valida las relaciones y fechas reales', async () => {
    for (const tipo of ['producto', 'lote']) {
      await api().get(`/api/v1/codigos/${tipo}`).expect(401);
      await api().get(`/api/v1/codigos/${tipo}`).set('Authorization', `Bearer ${vendedor}`).expect(403);
    }
    await api().get('/api/v1/codigos/producto?familiaId=no-es-id').set(auth()).expect(400);
    await api().get(`/api/v1/codigos/producto?familiaId=${randomUUID()}`).set(auth()).expect(404);
    for (const fecha of ['2026-02-30', '2026-13-01', '2099-01-01'])
      await api().get(`/api/v1/codigos/lote?productoId=${randomUUID()}&elaboradoEl=${fecha}`).set(auth()).expect(400);
  });

  it('resuelve dos altas con la misma sugerencia sin duplicar ni cambiar códigos', async () => {
    const { body } = await sugerir().expect(200);
    expect(body.codigo).toMatch(/^[A-Z0-9]{3}-\d{3,}$/);
    const r = await Promise.all([crear(body.codigo), crear(body.codigo.toLowerCase())]);
    expect(r.map(x => x.status).sort((a, b) => a - b)).toEqual([201, 409]);
    const siguiente = await sugerir().expect(200);
    expect(siguiente.body.codigo).not.toBe(body.codigo);
    const guardada = r.find(x => x.status === 201)!.body;
    expect(guardada.codigo).toBe(body.codigo);
    const lote = await api().get(`/api/v1/codigos/lote?productoId=${guardada.id}&elaboradoEl=2026-01-01`).set(auth()).expect(200);
    expect(lote.body.codigo).toBe(`TJ-ZAV-${body.codigo}-20260101-01`);
    await api().post('/api/v1/lotes').set(auth()).send({ operacionClave: randomUUID(), productoId: guardada.id, codigo: lote.body.codigo, elaboradoEl: '2026-01-01', venceEl: '2099-01-01', cantidadInicial: 1, ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO' }).expect(201);
    const otro = await api().get(`/api/v1/codigos/lote?productoId=${guardada.id}&elaboradoEl=2026-01-01`).set(auth()).expect(200);
    expect(otro.body.codigo).toBe(`TJ-ZAV-${body.codigo}-20260101-02`);
    await api().patch(`/api/v1/catalogo/presentaciones/${guardada.id}`).set(auth()).send({ activo: false }).expect(200);
    expect((await sugerir().expect(200)).body.codigo).not.toBe(body.codigo);
  });

  it('calcula series grandes sin pérdida de precisión y rechaza desbordar la longitud', async () => {
    const { body } = await sugerir().expect(200);
    await crear(`${body.prefijo}-9007199254740993`).expect(201);
    expect((await sugerir().expect(200)).body.codigo).toBe(`${body.prefijo}-9007199254740994`);
    await crear(`${body.prefijo}-${'9'.repeat(36)}`).expect(201);
    await sugerir().expect(409);
  });
});

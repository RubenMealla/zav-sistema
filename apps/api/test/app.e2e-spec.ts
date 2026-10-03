import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/v1/salud (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/salud')
      .expect(200)
      .expect({ estado: 'ok' });
  });

  it('responde 401 con el formato de error de la API', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/productos')
      .expect(401);

    expect(respuesta.body).toEqual(
      expect.objectContaining({
        statusCode: 401,
        path: '/api/v1/productos',
      }),
    );
    expect(respuesta.body.message).toEqual(expect.any(String));
    expect(respuesta.body.timestamp).toEqual(expect.any(String));
  });

  afterEach(async () => {
    await app.close();
  });
});

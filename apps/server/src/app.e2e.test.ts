import { afterEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './main.js';

describe('App HTTP runtime wiring', () => {
  let app: INestApplication | undefined;
  afterEach(async () => { await app?.close(); });

  it('injects services and creates a project and session', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    const projectResponse = await request(app.getHttpServer()).post('/api/v1/projects').send({ name: 'Runtime', rootPath: process.cwd() }).expect(201);
    const sessionResponse = await request(app.getHttpServer()).post(`/api/v1/projects/${projectResponse.body.id}/sessions`).send({}).expect(201);
    expect(sessionResponse.body.title).toBe('New Session');
  });
});

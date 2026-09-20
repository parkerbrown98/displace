import { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { DependencyProbe } from './../src/health/dependency-probe.js';
import { createTestApplication } from './factories/test-application.js';

describe('application foundation (e2e)', () => {
  let app: NestFastifyApplication;
  let dependenciesAvailable: boolean;

  beforeEach(async () => {
    dependenciesAvailable = true;
    const check = () =>
      dependenciesAvailable
        ? Promise.resolve()
        : Promise.reject(new Error('Unavailable'));
    const dependencyProbe: DependencyProbe = {
      checkObjectStorage: check,
      checkPostgres: check,
      checkRedis: check,
      checkSearch: check,
      checkVoice: check,
    };
    app = await createTestApplication({ dependencyProbe });
  });

  it('/api/v1/health/live (GET)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health/live',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('/api/v1/health/ready reports dependency state', async () => {
    const readyResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/health/ready',
    });

    expect(readyResponse.statusCode).toBe(200);
    expect(readyResponse.json()).toMatchObject({
      status: 'ready',
      dependencies: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
        objectStorage: { status: 'up' },
        search: { status: 'up' },
        voice: { status: 'up' },
      },
    });

    dependenciesAvailable = false;
    const unavailableResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/health/ready',
    });

    expect(unavailableResponse.statusCode).toBe(503);
    expect(unavailableResponse.json()).toMatchObject({
      title: 'Service Unavailable',
      status: 503,
      readiness: 'not_ready',
      dependencies: { postgres: { status: 'down' } },
    });
  });

  it('/api/docs-json (GET)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/docs-json',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      info: { title: 'Displace API', version: '1.0' },
      components: {
        securitySchemes: {
          bearer: { scheme: 'bearer', type: 'http' },
          session: { in: 'cookie', type: 'apiKey' },
        },
      },
      paths: {
        '/api/v1/health/live': {},
        '/api/v1/health/ready': {},
      },
    });
  });

  it('returns RFC 9457 problem details with the request ID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/missing',
      headers: { 'x-request-id': 'test-request-id' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.headers['x-request-id']).toBe('test-request-id');
    expect(response.json()).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      instance: '/api/v1/missing',
      requestId: 'test-request-id',
    });
  });

  it('closes a partially initialized test application', async () => {
    let closed = false;

    await expect(
      createTestApplication({
        onApplicationCreated(application) {
          const close = application.close.bind(application);
          application.close = async () => {
            closed = true;
            await close();
          };
          throw new Error('Injected initialization failure');
        },
      }),
    ).rejects.toThrow('Injected initialization failure');
    expect(closed).toBe(true);
  });

  afterEach(async () => {
    await app?.close();
  });
});

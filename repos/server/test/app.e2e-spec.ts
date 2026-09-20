import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { validateEnvironment } from './../src/config/environment.js';
import { DEPENDENCY_PROBE } from './../src/health/dependency-probe.js';
import { createFastifyAdapter } from './../src/platform/http/create-fastify-adapter.js';

describe('application foundation (e2e)', () => {
  let app: NestFastifyApplication;
  let dependenciesAvailable: boolean;

  beforeEach(async () => {
    dependenciesAvailable = true;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DEPENDENCY_PROBE)
      .useValue(
        Object.fromEntries(
          [
            'checkPostgres',
            'checkRedis',
            'checkObjectStorage',
            'checkSearch',
            'checkVoice',
          ].map((method) => [
            method,
            () =>
              dependenciesAvailable
                ? Promise.resolve()
                : Promise.reject(new Error('Unavailable')),
          ]),
        ),
      )
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      createFastifyAdapter(
        validateEnvironment({ ...process.env, NODE_ENV: 'test' }),
      ),
    );
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
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

  afterEach(async () => {
    await app?.close();
  });
});

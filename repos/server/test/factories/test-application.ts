import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import {
  validateEnvironment,
  type AppEnvironment,
} from '../../src/config/environment.js';
import { DEPENDENCY_PROBE } from '../../src/health/dependency-probe.js';
import type { DependencyProbe } from '../../src/health/dependency-probe.js';
import { createFastifyAdapter } from '../../src/platform/http/create-fastify-adapter.js';

export async function createTestApplication(
  options: {
    dependencyProbe?: DependencyProbe;
    environment?: Partial<Record<keyof AppEnvironment, unknown>>;
    onApplicationCreated?: (
      application: NestFastifyApplication,
    ) => Promise<void> | void;
  } = {},
): Promise<NestFastifyApplication> {
  const environment = validateEnvironment({
    ...process.env,
    ...options.environment,
    NODE_ENV: 'test',
  });
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(new ConfigService(environment));
  if (options.dependencyProbe) {
    builder = builder
      .overrideProvider(DEPENDENCY_PROBE)
      .useValue(options.dependencyProbe);
  }
  let moduleFixture: TestingModule | undefined;
  let app: NestFastifyApplication | undefined;
  try {
    moduleFixture = await builder.compile();
    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      createFastifyAdapter(environment),
    );
    await options.onApplicationCreated?.(app);
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
  } catch (error) {
    if (app) {
      await app.close().catch(() => undefined);
    } else {
      await moduleFixture?.close().catch(() => undefined);
    }
    throw error;
  }
}

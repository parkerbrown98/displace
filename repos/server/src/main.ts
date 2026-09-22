import { NestFactory } from '@nestjs/core';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { type AppEnvironment, validateEnvironment } from './config/environment.js';
import { createFastifyAdapter } from './platform/http/create-fastify-adapter.js';
import { RealtimeIoAdapter } from './realtime/realtime-io.adapter.js';

async function bootstrap(): Promise<void> {
  const environment = validateEnvironment(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    createFastifyAdapter(environment),
    { bufferLogs: true, rawBody: true },
  );

  await configureApp(app);
  app.useWebSocketAdapter(
    new RealtimeIoAdapter(
      app,
      app.get(ConfigService<AppEnvironment, true>),
    ),
  );

  await app.listen(environment.PORT, environment.HOST);
}
await bootstrap();

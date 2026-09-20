import { NestFactory } from '@nestjs/core';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { validateEnvironment } from './config/environment.js';
import { createFastifyAdapter } from './platform/http/create-fastify-adapter.js';

async function bootstrap(): Promise<void> {
  const environment = validateEnvironment(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    createFastifyAdapter(environment),
    { bufferLogs: true },
  );

  await configureApp(app);

  await app.listen(environment.PORT, environment.HOST);
}
await bootstrap();

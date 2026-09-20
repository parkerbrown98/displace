import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { validateEnvironment } from './config/environment.js';
import { WorkerModule } from './worker.module.js';

async function bootstrap(): Promise<void> {
  validateEnvironment(process.env);
  const application = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  application.useLogger(application.get(Logger));
  application.enableShutdownHooks();
  application.get(Logger).log('Worker runtime is ready.');
}

void bootstrap();

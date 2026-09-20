import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppEnvironment } from './config/environment.js';
import { ProblemDetailsDto } from './platform/http/problem-details.dto.js';
import { ProblemDetailsFilter } from './platform/http/problem-details.filter.js';

export async function configureApp(app: NestFastifyApplication): Promise<void> {
  const config = app.get(ConfigService<AppEnvironment, true>);
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(
    new ProblemDetailsFilter(
      logger,
      config.get('NODE_ENV', { infer: true }) === 'production',
    ),
  );

  await app.register(cookie, {
    secret: config.get('COOKIE_SECRET', { infer: true }),
  });
  await app.register(compress, { global: true });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });

  const allowedOrigins = new Set(config.get('CORS_ORIGINS', { infer: true }));
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS.'), false);
    },
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'X-CSRF-Token',
      'X-Request-Id',
    ],
    exposedHeaders: [
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Retry-After',
      'X-Request-Id',
    ],
  });

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, reply, done) => {
      void reply.header('X-Request-Id', request.id);
      done();
    });

  const openApiConfig = new DocumentBuilder()
    .setTitle('Displace API')
    .setDescription('The public API for Displace communities and clients.')
    .setVersion('1.0')
    .addServer(config.get('PUBLIC_URL', { infer: true }).toString())
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Short-lived access token.',
      },
      'bearer',
    )
    .addCookieAuth(
      'displace_session',
      { type: 'apiKey', in: 'cookie' },
      'session',
    )
    .addGlobalParameters({
      name: 'X-Request-Id',
      in: 'header',
      required: false,
      description: 'Optional caller-provided correlation identifier.',
      schema: { type: 'string', minLength: 8, maxLength: 128 },
    })
    .addGlobalResponse(
      {
        status: 400,
        description: 'Invalid request.',
        type: ProblemDetailsDto,
      },
      {
        status: 401,
        description: 'Authentication is required.',
        type: ProblemDetailsDto,
      },
      {
        status: 403,
        description: 'The operation is not permitted.',
        type: ProblemDetailsDto,
      },
      {
        status: 429,
        description: 'The request rate limit was exceeded.',
        type: ProblemDetailsDto,
      },
      {
        status: 500,
        description: 'Unexpected server error.',
        type: ProblemDetailsDto,
      },
    )
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig, {
    extraModels: [ProblemDetailsDto],
  });

  SwaggerModule.setup('api/docs', app, openApiDocument);
}

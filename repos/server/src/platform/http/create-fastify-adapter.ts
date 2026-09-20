import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppEnvironment } from '../../config/environment.js';

const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

export function createFastifyAdapter(
  environment: AppEnvironment,
): FastifyAdapter {
  return new FastifyAdapter({
    bodyLimit: environment.BODY_LIMIT_BYTES,
    trustProxy: environment.TRUST_PROXY,
    genReqId: (request: IncomingMessage) => {
      const requestId = request.headers['x-request-id'];
      return typeof requestId === 'string' && requestIdPattern.test(requestId)
        ? requestId
        : randomUUID();
    },
    logger: {
      level: environment.NODE_ENV === 'test' ? 'silent' : environment.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers.set-cookie',
          '*.password',
          '*.token',
          '*.secret',
        ],
        censor: '[Redacted]',
      },
      transport:
        environment.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: { colorize: true, singleLine: true },
            }
          : undefined,
    },
  });
}

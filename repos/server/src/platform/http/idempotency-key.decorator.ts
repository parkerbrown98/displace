import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{8,128}$/;

export const IdempotencyKey = createParamDecorator(
  (
    required: boolean | undefined,
    context: ExecutionContext,
  ): string | undefined => {
    const value = context.switchToHttp().getRequest<FastifyRequest>().headers[
      'idempotency-key'
    ];

    if (value === undefined && required === false) {
      return undefined;
    }

    if (typeof value !== 'string' || !idempotencyKeyPattern.test(value)) {
      throw new BadRequestException(
        'Idempotency-Key must be 8-128 URL-safe characters.',
      );
    }

    return value;
  },
);

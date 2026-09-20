import { BadRequestException } from '@nestjs/common';
import type { ArgumentsHost, LoggerService } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ProblemDetailsFilter } from './problem-details.filter.js';

describe('ProblemDetailsFilter', () => {
  it('does not allow exception extensions to replace canonical fields', () => {
    const send = vi.fn();
    const reply = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send,
    } as unknown as FastifyReply;
    const request = {
      id: 'request-123',
      url: '/api/v1/example',
    } as FastifyRequest;
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => reply,
      }),
    } as ArgumentsHost;
    const logger = { error: vi.fn() } as unknown as LoggerService;
    const filter = new ProblemDetailsFilter(logger, false);

    filter.catch(
      new BadRequestException({
        message: 'Original detail',
        type: 'https://attacker.invalid/problem',
        title: 'Injected title',
        status: 200,
        detail: 'Injected detail',
        instance: '/injected',
        requestId: 'injected-id',
        errors: ['Injected validation error'],
        safeExtension: 'preserved',
      }),
      host,
    );

    expect(send).toHaveBeenCalledWith({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Original detail',
      instance: '/api/v1/example',
      requestId: 'request-123',
      safeExtension: 'preserved',
    });
  });
});

import { STATUS_CODES } from 'node:http';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

type ErrorResponse = Record<string, unknown> & {
  error?: string;
  message?: string | string[];
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: LoggerService,
    private readonly isProduction: boolean,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const response =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const errorResponse =
      typeof response === 'object' && response !== null
        ? (response as ErrorResponse)
        : undefined;
    const validationErrors = Array.isArray(errorResponse?.message)
      ? errorResponse.message
      : undefined;
    const detail = this.getDetail(exception, response, validationErrors);
    const extensions = errorResponse
      ? Object.fromEntries(
          Object.entries(errorResponse).filter(
            ([key]) =>
              ![
                'detail',
                'error',
                'errors',
                'instance',
                'message',
                'requestId',
                'status',
                'statusCode',
                'title',
                'type',
              ].includes(key),
          ),
        )
      : {};

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          error: exception instanceof Error ? exception.stack : exception,
          requestId: request.id,
        },
        'Unhandled request error',
      );
    }

    void reply
      .status(status)
      .type('application/problem+json')
      .send({
        type: 'about:blank',
        title: errorResponse?.error ?? STATUS_CODES[status] ?? 'Request Failed',
        status,
        detail,
        instance: request.url,
        requestId: request.id,
        ...(validationErrors ? { errors: validationErrors } : {}),
        ...extensions,
      });
  }

  private getDetail(
    exception: unknown,
    response: string | object | undefined,
    validationErrors: string[] | undefined,
  ): string {
    if (validationErrors) {
      return 'Request validation failed.';
    }

    if (typeof response === 'string') {
      return response;
    }

    if (
      response &&
      'message' in response &&
      typeof response.message === 'string'
    ) {
      return response.message;
    }

    if (exception instanceof HttpException) {
      return exception.message;
    }

    return this.isProduction
      ? 'An unexpected error occurred.'
      : exception instanceof Error
        ? exception.message
        : 'An unexpected error occurred.';
  }
}

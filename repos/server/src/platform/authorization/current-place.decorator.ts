import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthorizedPlace } from './authorization-context.js';
import type { AuthorizedRequest } from './authorized-request.js';

export const CurrentPlace = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthorizedPlace | undefined =>
    context.switchToHttp().getRequest<AuthorizedRequest>().authorization?.place,
);

import type { FastifyRequest } from 'fastify';
import type { AuthorizationContext } from './authorization-context.js';

export type AuthorizedRequest = FastifyRequest & {
  authorization?: AuthorizationContext;
};

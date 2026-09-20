import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { AuthorizedRequest } from '../authorization/authorized-request.js';

export interface AuditContext {
  requestId: string;
  actorId?: string;
  placeId?: string;
  ipAddress: string;
}

@Injectable({ scope: Scope.REQUEST })
export class AuditContextService {
  constructor(@Inject(REQUEST) private readonly request: AuthorizedRequest) {}

  get(): AuditContext {
    return {
      requestId: this.request.id,
      actorId: this.request.authorization?.user.id,
      placeId: this.request.authorization?.place?.id,
      ipAddress: this.request.ip,
    };
  }
}

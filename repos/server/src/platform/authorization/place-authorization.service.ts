import { ForbiddenException, Injectable } from '@nestjs/common';
import type { PlaceScope } from '../../database/repositories/place-scope.js';
import type { AuthorizationContext } from './authorization-context.js';

@Injectable()
export class PlaceAuthorizationService {
  requireScope(authorization: AuthorizationContext, scope: PlaceScope): void {
    if (authorization.place?.id !== scope.placeId) {
      throw new ForbiddenException(
        'The authenticated context does not grant access to this place.',
      );
    }
  }
}

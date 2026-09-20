import { ForbiddenException } from '@nestjs/common';
import { placeScope } from '../../database/repositories/place-scope.js';
import type { AuthorizationContext } from './authorization-context.js';
import { PlaceAuthorizationService } from './place-authorization.service.js';

describe('PlaceAuthorizationService', () => {
  const service = new PlaceAuthorizationService();
  const authorization: AuthorizationContext = {
    permissions: new Set(),
    place: { id: 'place-a', slug: 'place-a' },
    user: { id: 'user-a' },
  };

  it('accepts the authorized place scope', () => {
    expect(() =>
      service.requireScope(authorization, placeScope('place-a')),
    ).not.toThrow();
  });

  it('rejects a different place scope', () => {
    expect(() =>
      service.requireScope(authorization, placeScope('place-b')),
    ).toThrow(ForbiddenException);
  });
});

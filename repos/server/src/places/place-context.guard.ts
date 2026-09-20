import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment.js';
import type { AuthorizedRequest } from '../platform/authorization/authorized-request.js';
import { PlacesRepository } from './places.repository.js';

@Injectable()
export class PlaceContextGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly places: PlacesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const identifier = (request.params as { placeId?: string }).placeId;
    if (!identifier) {
      throw new NotFoundException('Place was not found.');
    }
    const place = await this.places.findByIdentifier(identifier);
    const configuredSlug = this.config.get('SINGLE_PLACE_SLUG', { infer: true });
    if (
      !place ||
      place.archivedAt ||
      (this.config.get('SINGLE_PLACE_MODE', { infer: true }) &&
        place.slug !== configuredSlug)
    ) {
      throw new NotFoundException('Place was not found.');
    }

    const authorization = request.authorization;
    if (!authorization) {
      if (place.visibility !== 'public') {
        throw new NotFoundException('Place was not found.');
      }
      return true;
    }
    const grants = await this.places.getAuthorization(
      place.id,
      authorization.user.id,
    );
    if (!grants && place.visibility !== 'public') {
      throw new NotFoundException('Place was not found.');
    }
    authorization.place = { id: place.id, slug: place.slug };
    authorization.permissions = grants?.permissions ?? new Set();
    return true;
  }
}

@Injectable()
export class InviteRoleAuthorizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const roleId = (request.body as { roleId?: unknown } | undefined)?.roleId;
    if (
      roleId !== undefined &&
      !request.authorization?.permissions.has('role.manage')
    ) {
      throw new ForbiddenException(
        'Role management is required for role-bearing invites.',
      );
    }
    return true;
  }
}
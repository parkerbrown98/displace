import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthorizedRequest } from './authorized-request.js';
import { REQUIRED_PERMISSIONS } from './require-permissions.decorator.js';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions?.length) {
      return true;
    }

    const authorization = context
      .switchToHttp()
      .getRequest<AuthorizedRequest>().authorization;
    if (!authorization) {
      throw new UnauthorizedException('Authentication is required.');
    }

    if (
      !requiredPermissions.every((permission) =>
        authorization.permissions.has(permission),
      )
    ) {
      throw new ForbiddenException('Required permission is missing.');
    }

    return true;
  }
}

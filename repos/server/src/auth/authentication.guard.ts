import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthorizedRequest } from '../platform/authorization/authorized-request.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthService } from './auth.service.js';
import { DeveloperApiService } from '../developer-api/developer-api.service.js';
import { ApiTokenScope } from '../developer-api/developer-api.dto.js';
import { REQUIRED_PERMISSIONS } from '../platform/authorization/require-permissions.decorator.js';
import { REQUIRED_API_TOKEN_SCOPES } from './require-api-token-scopes.decorator.js';

const EXTERNAL_AUTHORIZATION = Symbol('external-authorization');

export const ExternalAuthorization = () => SetMetadata(EXTERNAL_AUTHORIZATION, true);

@Injectable()
export class AccessAuthenticationGuard implements CanActivate {
  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly authService: AuthService,
    private readonly developerApi: DeveloperApiService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'ws') {
      return true;
    }
    if (
      this.reflector.getAllAndOverride<boolean>(EXTERNAL_AUTHORIZATION, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization) {
      return true;
    }

    const [scheme, token, extra] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
      throw new UnauthorizedException('The authorization header is invalid.');
    }

    if (token.startsWith('dsp_')) {
      const authentication = await this.developerApi.authenticate(token);
      this.requireApiTokenScope(request.method, authentication.scopes, context);
      request.authorization = {
        permissions: new Set(),
        user: {
          apiTokenId: authentication.id,
          apiTokenScopes: authentication.scopes,
          id: authentication.userId,
        },
      };
      return true;
    }

    const claims = await this.accessTokens.verify(token);
    if (
      !(await this.authService.isSessionActive(claims.sessionId, claims.userId))
    ) {
      throw new UnauthorizedException(
        'The access token session is no longer active.',
      );
    }
    request.authorization = {
      permissions: new Set(),
      user: { id: claims.userId, sessionId: claims.sessionId },
    };
    return true;
  }

  private requireApiTokenScope(
    method: string,
    scopes: ReadonlySet<string>,
    context: ExecutionContext,
  ): void {
    const required = new Set<ApiTokenScope>([
      ['GET', 'HEAD', 'OPTIONS'].includes(method)
        ? ApiTokenScope.Read
        : ApiTokenScope.Write,
      ...(this.reflector.getAllAndOverride<ApiTokenScope[]>(
        REQUIRED_API_TOKEN_SCOPES,
        [context.getHandler(), context.getClass()],
      ) ?? []),
    ]);
    const permissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    if (permissions?.some((permission) => permission.startsWith('moderation.'))) {
      required.add(ApiTokenScope.Moderation);
    }
    for (const scope of required) {
      if (!scopes.has(scope)) {
        throw new ForbiddenException(`The API token requires the ${scope} scope.`);
      }
    }
  }
}

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    if (!request.authorization?.user) {
      throw new UnauthorizedException('Authentication is required.');
    }
    return true;
  }
}

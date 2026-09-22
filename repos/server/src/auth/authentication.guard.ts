import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthorizedRequest } from '../platform/authorization/authorized-request.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class AccessAuthenticationGuard implements CanActivate {
  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'ws') {
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

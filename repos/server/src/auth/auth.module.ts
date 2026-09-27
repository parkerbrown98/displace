import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from '../platform/http/rate-limit.guard.js';
import { AccessTokenService } from './access-token.service.js';
import {
  AccessAuthenticationGuard,
  AuthenticatedGuard,
} from './authentication.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthMailQueueService } from './auth-mail-queue.service.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { CsrfService } from './csrf.service.js';
import { OidcService } from './oidc.service.js';
import { ProfilesController } from './profiles.controller.js';
import { TokenHashService } from './token-hash.service.js';
import { DeveloperApiRepository } from '../developer-api/developer-api.repository.js';
import { DeveloperApiService } from '../developer-api/developer-api.service.js';

@Module({
  controllers: [AuthController, ProfilesController],
  providers: [
    AccessTokenService,
    AuthenticatedGuard,
    AuthMailQueueService,
    AuthRateLimitGuard,
    AuthRepository,
    AuthService,
    CsrfService,
    DeveloperApiRepository,
    DeveloperApiService,
    OidcService,
    TokenHashService,
    { provide: APP_GUARD, useClass: AccessAuthenticationGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [AccessTokenService, AuthMailQueueService, AuthService, DeveloperApiService, TokenHashService],
})
export class AuthModule {}

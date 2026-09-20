import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
import { TokenHashService } from './token-hash.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AccessTokenService,
    AuthenticatedGuard,
    AuthMailQueueService,
    AuthRateLimitGuard,
    AuthRepository,
    AuthService,
    CsrfService,
    OidcService,
    TokenHashService,
    { provide: APP_GUARD, useClass: AccessAuthenticationGuard },
  ],
  exports: [AuthMailQueueService, AuthService],
})
export class AuthModule {}

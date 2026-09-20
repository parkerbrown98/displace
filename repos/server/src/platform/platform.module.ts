import { Global, Module } from '@nestjs/common';
import { AuditContextService } from './audit/audit-context.service.js';
import { AuthorizationGuard } from './authorization/authorization.guard.js';
import { PlaceAuthorizationService } from './authorization/place-authorization.service.js';
import { CLOCK } from './clock/clock.js';
import { SystemClock } from './clock/system-clock.js';
import { CursorCodecService } from './pagination/cursor-codec.service.js';
import { SecureTokenGenerator } from './tokens/secure-token-generator.js';
import { TOKEN_GENERATOR } from './tokens/token-generator.js';

@Global()
@Module({
  providers: [
    AuditContextService,
    AuthorizationGuard,
    PlaceAuthorizationService,
    CursorCodecService,
    { provide: CLOCK, useClass: SystemClock },
    { provide: TOKEN_GENERATOR, useClass: SecureTokenGenerator },
  ],
  exports: [
    AuditContextService,
    AuthorizationGuard,
    PlaceAuthorizationService,
    CursorCodecService,
    CLOCK,
    TOKEN_GENERATOR,
  ],
})
export class PlatformModule {}

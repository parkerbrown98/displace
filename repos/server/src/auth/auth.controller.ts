import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiAcceptedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '../config/environment.js';
import { CurrentUser } from '../platform/authorization/current-user.decorator.js';
import type { AuthenticatedUser } from '../platform/authorization/authorization-context.js';
import {
  AuthenticationDto,
  ChangeEmailDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  MessageDto,
  OidcAuthorizeQueryDto,
  RefreshDto,
  RefreshTokenDelivery,
  RegisterDto,
  ResetPasswordDto,
  SessionDto,
  TokenDto,
  UpdateProfileDto,
  UserProfileDto,
} from './auth.dto.js';
import { AuthRateLimit, AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { AuthService, type IssuedAuthentication } from './auth.service.js';
import { AuthenticatedGuard } from './authentication.guard.js';
import { CsrfService } from './csrf.service.js';
import { OidcService } from './oidc.service.js';

const REFRESH_COOKIE = 'displace_session';
const CSRF_COOKIE = 'displace_csrf';
const OIDC_COOKIE = 'displace_oidc';
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

@ApiTags('Authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly applicationUrl: string;
  private readonly secureCookies: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly csrf: CsrfService,
    private readonly oidc: OidcService,
    config: ConfigService<AppEnvironment, true>,
  ) {
    this.applicationUrl = config.get('CORS_ORIGINS', { infer: true })[0]!;
    this.secureCookies =
      config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('register', 'email')
  @ApiAcceptedResponse({ type: MessageDto })
  async register(@Body() input: RegisterDto): Promise<MessageDto> {
    await this.authService.register(input);
    return {
      message:
        'If registration can proceed, a verification message has been queued.',
    };
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('verify-email', 'token')
  @ApiNoContentResponse()
  verifyEmail(@Body() input: TokenDto): Promise<void> {
    return this.authService.verifyEmail(input.token);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('login', 'identifier')
  @ApiOkResponse({ type: AuthenticationDto })
  async login(
    @Body() input: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthenticationDto> {
    const authentication = await this.authService.login(
      input.identifier,
      input.password,
      this.getRequestMetadata(request),
    );
    return this.deliverAuthentication(
      authentication,
      input.refreshTokenDelivery,
      reply,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('refresh', 'refreshToken')
  @ApiOkResponse({ type: AuthenticationDto })
  async refresh(
    @Body() input: RefreshDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthenticationDto> {
    const refreshToken =
      input.refreshToken ?? this.getSignedRefreshCookie(request);
    if (!input.refreshToken) {
      this.verifyCsrf(request);
    }
    const authentication = await this.authService.refresh(
      refreshToken ?? '',
      this.getRequestMetadata(request),
    );
    return this.deliverAuthentication(
      authentication,
      input.refreshTokenDelivery,
      reply,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, AuthRateLimitGuard)
  @AuthRateLimit('logout')
  @ApiBearerAuth('bearer')
  @ApiNoContentResponse()
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    this.verifyCsrfWhenCookiePresent(request);
    await this.authService.revokeSession(user.id, user.sessionId!);
    this.clearCookies(reply);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, AuthRateLimitGuard)
  @AuthRateLimit('logout-all')
  @ApiBearerAuth('bearer')
  @ApiNoContentResponse()
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    this.verifyCsrfWhenCookiePresent(request);
    await this.authService.revokeAllSessions(user.id);
    this.clearCookies(reply);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('forgot-password', 'email')
  @ApiOkResponse({ type: MessageDto })
  async forgotPassword(@Body() input: ForgotPasswordDto): Promise<MessageDto> {
    await this.authService.forgotPassword(input.email);
    return {
      message: 'If the account exists, a reset message has been queued.',
    };
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('reset-password', 'token')
  @ApiNoContentResponse()
  resetPassword(@Body() input: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(input.token, input.password);
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: UserProfileDto })
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileDto> {
    return this.authService.getProfile(user.id);
  }

  @Patch('me')
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: UserProfileDto })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    return this.authService.updateProfile(user.id, input);
  }

  @Post('email/change')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthenticatedGuard, AuthRateLimitGuard)
  @AuthRateLimit('change-email', 'email')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: MessageDto })
  async changeEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ChangeEmailDto,
  ): Promise<MessageDto> {
    await this.authService.changeEmail(user.id, input.email);
    return { message: 'A verification message has been queued.' };
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, AuthRateLimitGuard)
  @AuthRateLimit('change-password')
  @ApiBearerAuth('bearer')
  @ApiNoContentResponse()
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changePassword(
      user.id,
      user.sessionId!,
      input.currentPassword,
      input.newPassword,
    );
  }

  @Get('sessions')
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: SessionDto, isArray: true })
  listSessions(@CurrentUser() user: AuthenticatedUser): Promise<SessionDto[]> {
    return this.authService.listSessions(user.id, user.sessionId!);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth('bearer')
  @ApiNoContentResponse()
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    return this.authService.revokeSession(user.id, sessionId);
  }

  @Get('oidc/authorize')
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('oidc-authorize')
  async authorizeOidc(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: OidcAuthorizeQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (query.mode === 'link' && !user) {
      throw new UnauthorizedException(
        'Authentication is required to link an identity.',
      );
    }
    const authorization = await this.oidc.begin(
      query.mode === 'link'
        ? { sessionId: user!.sessionId!, userId: user!.id }
        : undefined,
    );
    void reply.setCookie(OIDC_COOKIE, authorization.cookie, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: '/api/v1/auth/oidc/callback',
      sameSite: 'lax',
      secure: this.secureCookies,
    });
    await reply.redirect(authorization.url.toString());
  }

  @Get('oidc/callback')
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('oidc-callback')
  async completeOidc(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.oidc.complete(
      new URL(request.url, `${request.protocol}://${request.hostname}`),
      request.cookies[OIDC_COOKIE],
    );
    void reply.clearCookie(OIDC_COOKIE, {
      path: '/api/v1/auth/oidc/callback',
    });
    const authentication = await this.authService.loginWithOidc(
      result.identity,
      this.getRequestMetadata(request),
      result.linkUserId,
      result.linkSessionId,
    );
    this.deliverAuthentication(
      authentication,
      RefreshTokenDelivery.Cookie,
      reply,
    );
    await reply.redirect(new URL('/auth/callback', this.applicationUrl).toString());
  }

  private deliverAuthentication(
    authentication: IssuedAuthentication,
    delivery: RefreshTokenDelivery,
    reply: FastifyReply,
  ): AuthenticationDto {
    if (delivery === RefreshTokenDelivery.ResponseBody) {
      return authentication;
    }

    const csrfToken = this.csrf.generate();
    const commonOptions = {
      maxAge: REFRESH_MAX_AGE_SECONDS,
      sameSite: 'strict' as const,
      secure: this.secureCookies,
    };
    void reply.setCookie(REFRESH_COOKIE, authentication.refreshToken, {
      ...commonOptions,
      httpOnly: true,
      path: '/api/v1/auth',
      signed: true,
    });
    void reply.setCookie(CSRF_COOKIE, csrfToken, {
      ...commonOptions,
      httpOnly: false,
      path: '/',
    });
    return {
      accessToken: authentication.accessToken,
      csrfToken,
      expiresInSeconds: authentication.expiresInSeconds,
      user: authentication.user,
    };
  }

  private verifyCsrf(request: FastifyRequest): void {
    const header = request.headers['x-csrf-token'];
    this.csrf.verify(
      request.cookies[CSRF_COOKIE],
      Array.isArray(header) ? header[0] : header,
    );
  }

  private verifyCsrfWhenCookiePresent(request: FastifyRequest): void {
    if (request.cookies[REFRESH_COOKIE]) {
      this.verifyCsrf(request);
    }
  }

  private getSignedRefreshCookie(request: FastifyRequest): string | undefined {
    const cookie = request.cookies[REFRESH_COOKIE];
    if (!cookie) {
      return undefined;
    }
    const unsigned = request.unsignCookie(cookie);
    return unsigned.valid ? unsigned.value : undefined;
  }

  private clearCookies(reply: FastifyReply): void {
    void reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    void reply.clearCookie(CSRF_COOKIE, { path: '/' });
  }

  private getRequestMetadata(request: FastifyRequest) {
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']?.slice(0, 1_024),
    };
  }
}

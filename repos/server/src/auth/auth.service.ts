import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';
import { AuthMailQueueService } from './auth-mail-queue.service.js';
import type { AuthMailJob } from './auth-mail.types.js';
import { AuthRepository, type AuthUserRecord } from './auth.repository.js';
import type {
  AuthenticationDto,
  SessionDto,
  UserProfileDto,
} from './auth.dto.js';
import { AccessTokenService } from './access-token.service.js';
import { TokenHashService } from './token-hash.service.js';
import { CLOCK, type Clock } from '../platform/clock/clock.js';
import {
  TOKEN_GENERATOR,
  type TokenGenerator,
} from '../platform/tokens/token-generator.js';

const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;
const EMAIL_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const PASSWORD_RESET_LIFETIME_MS = 60 * 60 * 1_000;
const INVALID_CREDENTIALS = 'The credentials are invalid.';
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$Dk5ryzDDbKtyEs+MCyhAlA$JuUzZZlCBB6kfpXGsZStooRtQ4gjUtXdpWKxdC2jMTM';

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface IssuedAuthentication extends AuthenticationDto {
  refreshToken: string;
}

export interface OidcIdentity {
  claims: Record<string, unknown>;
  email?: string;
  emailVerified: boolean;
  issuer: string;
  name?: string;
  subject: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly mailQueue: AuthMailQueueService,
    private readonly repository: AuthRepository,
    private readonly tokenHashes: TokenHashService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
  ) {}

  async register(input: {
    displayName: string;
    email: string;
    handle: string;
    password: string;
  }): Promise<void> {
    if ((await this.repository.getRegistrationMode()) !== 'open') {
      throw new ForbiddenException('Registration is not currently open.');
    }

    const email = input.email.trim().toLowerCase();
    const handle = input.handle.trim().toLowerCase();
    const passwordHash = await this.hashPassword(input.password);
    let mailJob: AuthMailJob = { kind: 'registration-attempt' };
    let duplicateRegistration = false;
    try {
      const registration = await this.repository.createRegistration(
        {
          displayName: input.displayName.trim(),
          email,
          handle,
          passwordHash,
        },
        (emailId) => this.createOneTimeToken(emailId, EMAIL_TOKEN_LIFETIME_MS),
      );
      mailJob = {
        kind: 'verify-email',
        recipient: email,
        token: registration.token,
      };
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
      duplicateRegistration = true;
    }

    if (duplicateRegistration) {
      const replacementToken =
        await this.repository.replaceVerificationTokenForUnverifiedEmail(
          email,
          (emailId) =>
            this.createOneTimeToken(emailId, EMAIL_TOKEN_LIFETIME_MS),
          this.clock.now(),
        );
      if (replacementToken) {
        mailJob = {
          kind: 'verify-email',
          recipient: email,
          token: replacementToken,
        };
      }
    }
    await this.enqueueWithoutDisclosure(mailJob);
  }

  async verifyEmail(token: string): Promise<void> {
    const emailId = this.getTokenSubject(token);
    const verified = await this.repository.verifyEmail(
      emailId,
      this.tokenHashes.hash(token),
      this.clock.now(),
    );
    if (!verified) {
      throw new UnauthorizedException(
        'The verification token is invalid or expired.',
      );
    }
  }

  async login(
    identifier: string,
    password: string,
    metadata: RequestMetadata,
  ): Promise<IssuedAuthentication> {
    const user = await this.repository.findUserByIdentifier(
      identifier.trim().toLowerCase(),
    );
    const passwordMatches = await verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      password,
    );
    if (!user?.passwordHash || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!user.emailVerified) {
      throw new ForbiddenException('Email verification is required.');
    }
    return this.createAuthentication(user, metadata);
  }

  async refresh(
    refreshToken: string,
    metadata: RequestMetadata,
  ): Promise<IssuedAuthentication> {
    const now = this.clock.now();
    const current = await this.repository.findSessionByRefreshHash(
      this.tokenHashes.hash(refreshToken),
    );
    if (!current) {
      throw new UnauthorizedException(
        'The refresh token is invalid or expired.',
      );
    }
    if (
      current.revokedAt ||
      current.expiresAt <= now ||
      current.userStatus !== 'active'
    ) {
      await this.repository.revokeTokenFamily(current.tokenFamilyId, now);
      throw new UnauthorizedException(
        'The refresh token is invalid or expired.',
      );
    }

    const replacement = this.tokenGenerator.generate(48);
    const replacementId = await this.repository.rotateSession(
      current,
      {
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_LIFETIME_MS),
        ipAddress: metadata.ipAddress,
        refreshTokenHash: this.tokenHashes.hash(replacement),
        userAgent: metadata.userAgent,
      },
      now,
    );
    if (!replacementId) {
      throw new UnauthorizedException('Refresh token reuse was detected.');
    }

    const user = await this.requireActiveUser(current.userId);
    return {
      accessToken: await this.accessTokens.issue(user.id, replacementId),
      expiresInSeconds: 15 * 60,
      refreshToken: replacement,
      user: this.toProfile(user),
    };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.repository.findUserByIdentifier(
      email.trim().toLowerCase(),
    );
    let mailJob: AuthMailJob = { kind: 'password-reset-attempt' };
    if (user && user.status === 'active') {
      const token = this.createOneTimeToken(
        user.id,
        PASSWORD_RESET_LIFETIME_MS,
      );
      await this.repository.createPasswordResetToken(
        user.id,
        token,
        this.clock.now(),
      );
      mailJob = {
        kind: 'reset-password',
        recipient: user.email,
        token: token.value,
      };
    }
    await this.enqueueWithoutDisclosure(mailJob);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const passwordHash = await this.hashPassword(password);
    if (
      !(await this.repository.resetPassword(
        this.tokenHashes.hash(token),
        passwordHash,
        this.clock.now(),
      ))
    ) {
      throw new UnauthorizedException('The reset token is invalid or expired.');
    }
  }

  async getProfile(userId: string): Promise<UserProfileDto> {
    return this.toProfile(await this.requireActiveUser(userId));
  }

  async updateProfile(
    userId: string,
    values: { displayName?: string; handle?: string },
  ): Promise<UserProfileDto> {
    try {
      await this.repository.updateProfile(
        userId,
        {
          displayName: values.displayName?.trim(),
          handle: values.handle?.trim().toLowerCase(),
        },
        this.clock.now(),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('The handle is already in use.');
      }
      throw error;
    }
    return this.getProfile(userId);
  }

  async changeEmail(userId: string, requestedEmail: string): Promise<void> {
    const email = requestedEmail.trim().toLowerCase();
    try {
      const token = await this.repository.createEmailChangeToken(
        userId,
        email,
        (emailId) => this.createOneTimeToken(emailId, EMAIL_TOKEN_LIFETIME_MS),
        this.clock.now(),
      );
      await this.mailQueue.enqueue({
        kind: 'verify-email',
        recipient: email,
        token,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('The email is already in use.');
      }
      throw error;
    }
  }

  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.requireActiveUser(userId);
    if (
      !user.passwordHash ||
      !(await verify(user.passwordHash, currentPassword))
    ) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    await this.repository.updatePassword(
      userId,
      await this.hashPassword(newPassword),
      sessionId,
      this.clock.now(),
    );
  }

  async listSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<SessionDto[]> {
    const records = await this.repository.listSessions(
      userId,
      this.clock.now(),
    );
    return records.map((record) => ({
      ...record,
      current: record.id === currentSessionId,
    }));
  }

  async loginWithOidc(
    identity: OidcIdentity,
    metadata: RequestMetadata,
    linkUserId?: string,
    linkSessionId?: string,
  ): Promise<IssuedAuthentication> {
    const provider = `oidc:${createHash('sha256')
      .update(identity.issuer)
      .digest('base64url')}`;
    const existingIdentity = await this.repository.findExternalIdentity(
      provider,
      identity.subject,
    );
    if (
      (linkUserId || linkSessionId) &&
      (!linkUserId ||
        !linkSessionId ||
        !(await this.repository.isSessionActive(
          linkSessionId,
          linkUserId,
          this.clock.now(),
        )))
    ) {
      throw new UnauthorizedException(
        'The session that initiated account linking is no longer active.',
      );
    }
    if (existingIdentity) {
      if (linkUserId && existingIdentity.userId !== linkUserId) {
        throw new ConflictException(
          'This provider identity is already linked.',
        );
      }
      return this.createAuthentication(
        await this.requireActiveUser(existingIdentity.userId),
        metadata,
      );
    }

    if (linkUserId) {
      const linked = await this.repository.linkExternalIdentity(
        linkUserId,
        linkSessionId!,
        provider,
        identity.subject,
        identity.claims,
        this.clock.now(),
      );
      if (!linked) {
        throw new UnauthorizedException(
          'The session that initiated account linking is no longer active.',
        );
      }
      return this.createAuthentication(
        await this.requireActiveUser(linkUserId),
        metadata,
      );
    }

    if (!identity.email || !identity.emailVerified) {
      throw new ForbiddenException(
        'The identity provider must supply a verified email address.',
      );
    }
    const email = identity.email.trim().toLowerCase();
    if (await this.repository.findUserByIdentifier(email)) {
      throw new ConflictException(
        'Sign in with the existing account before linking this provider.',
      );
    }
    if ((await this.repository.getRegistrationMode()) !== 'open') {
      throw new ForbiddenException('Registration is not currently open.');
    }

    const baseHandle = this.oidcHandle(identity, email);
    try {
      const user = await this.repository.createOidcUser({
        claims: identity.claims,
        displayName: identity.name?.trim().slice(0, 100) || baseHandle,
        email,
        handle: `${baseHandle.slice(0, 25)}_${this.tokenGenerator
          .generate(4)
          .slice(0, 6)
          .toLowerCase()}`,
        provider,
        subject: identity.subject,
      });
      return this.createAuthentication(user, metadata);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'The provider identity or email is already linked.',
        );
      }
      throw error;
    }
  }

  revokeSession(userId: string, sessionId: string): Promise<void> {
    return this.repository.revokeSession(userId, sessionId, this.clock.now());
  }

  revokeAllSessions(userId: string): Promise<void> {
    return this.repository.revokeAllSessions(userId, this.clock.now());
  }

  isSessionActive(sessionId: string, userId: string): Promise<boolean> {
    return this.repository.isSessionActive(sessionId, userId, this.clock.now());
  }

  private async createAuthentication(
    user: AuthUserRecord,
    metadata: RequestMetadata,
  ): Promise<IssuedAuthentication> {
    const refreshToken = this.tokenGenerator.generate(48);
    const now = this.clock.now();
    const sessionId = await this.repository.createSession({
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_LIFETIME_MS),
      ipAddress: metadata.ipAddress,
      refreshTokenHash: this.tokenHashes.hash(refreshToken),
      userAgent: metadata.userAgent,
      userId: user.id,
    });
    return {
      accessToken: await this.accessTokens.issue(user.id, sessionId),
      expiresInSeconds: 15 * 60,
      refreshToken,
      user: this.toProfile(user),
    };
  }

  private createOneTimeToken(subject: string, lifetimeMs: number): TokenValue {
    const value = `${subject}.${this.tokenGenerator.generate(32)}`;
    return {
      expiresAt: new Date(this.clock.now().getTime() + lifetimeMs),
      hash: this.tokenHashes.hash(value),
      value,
    };
  }

  private getTokenSubject(token: string): string {
    const separator = token.indexOf('.');
    if (separator <= 0) {
      throw new UnauthorizedException('The token is invalid or expired.');
    }
    return token.slice(0, separator);
  }

  private async hashPassword(password: string): Promise<string> {
    return hash(password, {
      memoryCost: 19_456,
      parallelism: 1,
      timeCost: 2,
      type: argon2id,
    });
  }

  private async enqueueWithoutDisclosure(job: AuthMailJob): Promise<void> {
    try {
      await this.mailQueue.enqueue(job);
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Authentication mail enqueue failed',
      );
    }
  }

  private oidcHandle(identity: OidcIdentity, email: string): string {
    const preferred =
      typeof identity.claims.preferred_username === 'string'
        ? identity.claims.preferred_username
        : email.split('@')[0];
    const normalized = preferred
      ?.toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '');
    return normalized && normalized.length >= 3 ? normalized : 'member';
  }

  private async requireActiveUser(userId: string): Promise<AuthUserRecord> {
    const user = await this.repository.findUserById(userId);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Authentication is required.');
    }
    return user;
  }

  private toProfile(user: AuthUserRecord): UserProfileDto {
    return {
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      handle: user.handle,
      id: user.id,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    let current = error;
    const seen = new Set<unknown>();
    while (
      typeof current === 'object' &&
      current !== null &&
      !seen.has(current)
    ) {
      if ('code' in current && current.code === '23505') {
        return true;
      }
      seen.add(current);
      current = 'cause' in current ? current.cause : undefined;
    }
    return false;
  }
}

interface TokenValue {
  expiresAt: Date;
  hash: string;
  value: string;
}

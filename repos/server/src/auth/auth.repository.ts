import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, ne, or } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  authTokens,
  externalIdentities,
  instanceSettings,
  sessions,
  userEmails,
  users,
} from '../database/schema/index.js';

export interface AuthUserRecord {
  displayName: string;
  email: string;
  emailVerified: boolean;
  handle: string;
  id: string;
  passwordHash: string | null;
  status: 'active' | 'suspended' | 'deleted';
}

export interface PublicProfileRecord {
  createdAt: Date;
  displayName: string;
  handle: string;
}

export interface SessionRecord {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  ipAddress: string | null;
  lastSeenAt: Date;
  revokedAt: Date | null;
  tokenFamilyId: string;
  userAgent: string | null;
  userId: string;
  userStatus: 'active' | 'suspended' | 'deleted';
}

interface SessionInput {
  expiresAt: Date;
  ipAddress?: string;
  refreshTokenHash: string;
  tokenFamilyId?: string;
  userAgent?: string;
  userId: string;
}

interface RegistrationInput {
  displayName: string;
  email: string;
  handle: string;
  passwordHash: string;
}

interface OidcRegistrationInput {
  claims: Record<string, unknown>;
  displayName: string;
  email: string;
  handle: string;
  provider: string;
  subject: string;
}

interface TokenValue {
  expiresAt: Date;
  hash: string;
  value: string;
}

@Injectable()
export class AuthRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async getRegistrationMode(): Promise<'open' | 'invite_only' | 'closed'> {
    const [settings] = await this.database
      .select({ registrationMode: instanceSettings.registrationMode })
      .from(instanceSettings)
      .where(eq(instanceSettings.id, 1))
      .limit(1);
    return settings?.registrationMode ?? 'open';
  }

  async createRegistration(
    input: RegistrationInput,
    createToken: (emailId: string) => TokenValue,
  ): Promise<{ token: string; user: AuthUserRecord }> {
    return this.database.transaction(async (transaction) => {
      const [user] = await transaction
        .insert(users)
        .values({
          displayName: input.displayName,
          handle: input.handle,
          passwordHash: input.passwordHash,
        })
        .returning({
          displayName: users.displayName,
          handle: users.handle,
          id: users.id,
          passwordHash: users.passwordHash,
          status: users.status,
        });
      if (!user) {
        throw new Error('Registration did not return a user.');
      }

      const [email] = await transaction
        .insert(userEmails)
        .values({ email: input.email, isPrimary: true, userId: user.id })
        .returning({ id: userEmails.id });
      if (!email) {
        throw new Error('Registration did not return an email.');
      }

      const token = createToken(email.id);
      await transaction.insert(authTokens).values({
        expiresAt: token.expiresAt,
        tokenHash: token.hash,
        type: 'email_verification',
        userId: user.id,
      });

      return {
        token: token.value,
        user: {
          ...user,
          email: input.email,
          emailVerified: false,
        },
      };
    });
  }

  async replaceVerificationTokenForUnverifiedEmail(
    email: string,
    createToken: (emailId: string) => TokenValue,
    now: Date,
  ): Promise<string | undefined> {
    return this.database.transaction(async (transaction) => {
      const [record] = await transaction
        .select({ id: userEmails.id, userId: userEmails.userId })
        .from(userEmails)
        .innerJoin(users, eq(users.id, userEmails.userId))
        .where(
          and(
            eq(userEmails.email, email),
            isNull(userEmails.verifiedAt),
            eq(users.status, 'active'),
          ),
        )
        .for('update')
        .limit(1);
      if (!record) {
        return undefined;
      }
      await transaction
        .update(authTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(authTokens.userId, record.userId),
            eq(authTokens.type, 'email_verification'),
            isNull(authTokens.consumedAt),
          ),
        );
      const token = createToken(record.id);
      await transaction.insert(authTokens).values({
        expiresAt: token.expiresAt,
        tokenHash: token.hash,
        type: 'email_verification',
        userId: record.userId,
      });
      return token.value;
    });
  }

  async findUserByIdentifier(
    identifier: string,
  ): Promise<AuthUserRecord | undefined> {
    const [record] = await this.database
      .select({
        displayName: users.displayName,
        email: userEmails.email,
        emailVerified: userEmails.verifiedAt,
        handle: users.handle,
        id: users.id,
        passwordHash: users.passwordHash,
        status: users.status,
      })
      .from(users)
      .innerJoin(
        userEmails,
        and(eq(userEmails.userId, users.id), eq(userEmails.isPrimary, true)),
      )
      .where(or(eq(users.handle, identifier), eq(userEmails.email, identifier)))
      .limit(1);
    return record
      ? { ...record, emailVerified: record.emailVerified !== null }
      : undefined;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | undefined> {
    const [record] = await this.database
      .select({
        displayName: users.displayName,
        email: userEmails.email,
        emailVerified: userEmails.verifiedAt,
        handle: users.handle,
        id: users.id,
        passwordHash: users.passwordHash,
        status: users.status,
      })
      .from(users)
      .innerJoin(
        userEmails,
        and(eq(userEmails.userId, users.id), eq(userEmails.isPrimary, true)),
      )
      .where(eq(users.id, userId))
      .limit(1);
    return record
      ? { ...record, emailVerified: record.emailVerified !== null }
      : undefined;
  }

  async findPublicProfileByHandle(
    handle: string,
  ): Promise<PublicProfileRecord | undefined> {
    const [profile] = await this.database
      .select({
        createdAt: users.createdAt,
        displayName: users.displayName,
        handle: users.handle,
      })
      .from(users)
      .where(and(eq(users.handle, handle), eq(users.status, 'active')))
      .limit(1);
    return profile;
  }

  async createSession(input: SessionInput): Promise<string> {
    const [session] = await this.database
      .insert(sessions)
      .values(input)
      .returning({ id: sessions.id });
    if (!session) {
      throw new Error('Session creation did not return a session.');
    }
    return session.id;
  }

  async findSessionByRefreshHash(
    refreshTokenHash: string,
  ): Promise<SessionRecord | undefined> {
    const [session] = await this.database
      .select({
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
        id: sessions.id,
        ipAddress: sessions.ipAddress,
        lastSeenAt: sessions.lastSeenAt,
        revokedAt: sessions.revokedAt,
        tokenFamilyId: sessions.tokenFamilyId,
        userAgent: sessions.userAgent,
        userId: sessions.userId,
        userStatus: users.status,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.refreshTokenHash, refreshTokenHash))
      .limit(1);
    return session;
  }

  async rotateSession(
    currentSession: SessionRecord,
    input: Omit<SessionInput, 'tokenFamilyId' | 'userId'>,
    now: Date,
  ): Promise<string | undefined> {
    return this.database.transaction(async (transaction) => {
      const [revoked] = await transaction
        .update(sessions)
        .set({ lastSeenAt: now, revokedAt: now })
        .where(
          and(
            eq(sessions.id, currentSession.id),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, now),
          ),
        )
        .returning({ id: sessions.id });
      if (!revoked) {
        await transaction
          .update(sessions)
          .set({ revokedAt: now })
          .where(
            and(
              eq(sessions.tokenFamilyId, currentSession.tokenFamilyId),
              isNull(sessions.revokedAt),
            ),
          );
        return undefined;
      }

      const [replacement] = await transaction
        .insert(sessions)
        .values({
          ...input,
          tokenFamilyId: currentSession.tokenFamilyId,
          userId: currentSession.userId,
        })
        .returning({ id: sessions.id });
      return replacement?.id;
    });
  }

  async revokeTokenFamily(tokenFamilyId: string, now: Date): Promise<void> {
    await this.database
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.tokenFamilyId, tokenFamilyId),
          isNull(sessions.revokedAt),
        ),
      );
  }

  async isSessionActive(
    sessionId: string,
    userId: string,
    now: Date,
  ): Promise<boolean> {
    const [session] = await this.database
      .select({ id: sessions.id })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
          eq(users.status, 'active'),
        ),
      )
      .limit(1);
    return Boolean(session);
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<void> {
    await this.database
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
        ),
      );
  }

  async revokeAllSessions(
    userId: string,
    now: Date,
    exceptSessionId?: string,
  ): Promise<void> {
    await this.database
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined,
        ),
      );
  }

  listSessions(userId: string, now: Date) {
    return this.database
      .select({
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
        id: sessions.id,
        ipAddress: sessions.ipAddress,
        lastSeenAt: sessions.lastSeenAt,
        userAgent: sessions.userAgent,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      )
      .orderBy(desc(sessions.lastSeenAt), desc(sessions.id));
  }

  async createPasswordResetToken(
    userId: string,
    token: TokenValue,
    now: Date,
  ): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction
        .update(authTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(authTokens.userId, userId),
            eq(authTokens.type, 'password_reset'),
            isNull(authTokens.consumedAt),
          ),
        );
      await transaction.insert(authTokens).values({
        expiresAt: token.expiresAt,
        tokenHash: token.hash,
        type: 'password_reset',
        userId,
      });
    });
  }

  async resetPassword(
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const [token] = await transaction
        .update(authTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(authTokens.tokenHash, tokenHash),
            eq(authTokens.type, 'password_reset'),
            isNull(authTokens.consumedAt),
            gt(authTokens.expiresAt, now),
          ),
        )
        .returning({ userId: authTokens.userId });
      if (!token) {
        return false;
      }

      await transaction
        .update(users)
        .set({ passwordHash, updatedAt: now })
        .where(eq(users.id, token.userId));
      await transaction
        .update(sessions)
        .set({ revokedAt: now })
        .where(
          and(eq(sessions.userId, token.userId), isNull(sessions.revokedAt)),
        );
      return true;
    });
  }

  async verifyEmail(
    emailId: string,
    tokenHash: string,
    now: Date,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const [token] = await transaction
        .update(authTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(authTokens.tokenHash, tokenHash),
            eq(authTokens.type, 'email_verification'),
            isNull(authTokens.consumedAt),
            gt(authTokens.expiresAt, now),
          ),
        )
        .returning({ userId: authTokens.userId });
      if (!token) {
        return false;
      }

      const [email] = await transaction
        .select({ isPrimary: userEmails.isPrimary })
        .from(userEmails)
        .where(
          and(eq(userEmails.id, emailId), eq(userEmails.userId, token.userId)),
        )
        .limit(1);
      if (!email) {
        return false;
      }

      if (!email.isPrimary) {
        await transaction
          .update(userEmails)
          .set({ isPrimary: false })
          .where(eq(userEmails.userId, token.userId));
      }
      await transaction
        .update(userEmails)
        .set({ isPrimary: true, verifiedAt: now })
        .where(eq(userEmails.id, emailId));
      return true;
    });
  }

  async createEmailChangeToken(
    userId: string,
    email: string,
    createToken: (emailId: string) => TokenValue,
    now: Date,
  ): Promise<string> {
    return this.database.transaction(async (transaction) => {
      await transaction
        .delete(userEmails)
        .where(
          and(
            eq(userEmails.userId, userId),
            eq(userEmails.isPrimary, false),
            isNull(userEmails.verifiedAt),
          ),
        );
      await transaction
        .update(authTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(authTokens.userId, userId),
            eq(authTokens.type, 'email_verification'),
            isNull(authTokens.consumedAt),
          ),
        );
      const [newEmail] = await transaction
        .insert(userEmails)
        .values({ email, userId })
        .returning({ id: userEmails.id });
      if (!newEmail) {
        throw new Error('Email change did not return an email.');
      }
      const token = createToken(newEmail.id);
      await transaction.insert(authTokens).values({
        expiresAt: token.expiresAt,
        tokenHash: token.hash,
        type: 'email_verification',
        userId,
      });
      return token.value;
    });
  }

  async updateProfile(
    userId: string,
    values: { displayName?: string; handle?: string },
    now: Date,
  ): Promise<void> {
    if (values.displayName === undefined && values.handle === undefined) {
      return;
    }
    await this.database
      .update(users)
      .set({ ...values, updatedAt: now })
      .where(eq(users.id, userId));
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
    currentSessionId: string,
    now: Date,
  ): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction
        .update(users)
        .set({ passwordHash, updatedAt: now })
        .where(eq(users.id, userId));
      await transaction
        .update(sessions)
        .set({ revokedAt: now })
        .where(
          and(
            eq(sessions.userId, userId),
            ne(sessions.id, currentSessionId),
            isNull(sessions.revokedAt),
          ),
        );
    });
  }

  async findExternalIdentity(provider: string, subject: string) {
    const [identity] = await this.database
      .select({ userId: externalIdentities.userId })
      .from(externalIdentities)
      .where(
        and(
          eq(externalIdentities.provider, provider),
          eq(externalIdentities.subject, subject),
        ),
      )
      .limit(1);
    return identity;
  }

  async createOidcUser(input: OidcRegistrationInput): Promise<AuthUserRecord> {
    return this.database.transaction(async (transaction) => {
      const [user] = await transaction
        .insert(users)
        .values({ displayName: input.displayName, handle: input.handle })
        .returning({
          displayName: users.displayName,
          handle: users.handle,
          id: users.id,
          passwordHash: users.passwordHash,
          status: users.status,
        });
      if (!user) {
        throw new Error('OIDC registration did not return a user.');
      }
      await transaction.insert(userEmails).values({
        email: input.email,
        isPrimary: true,
        userId: user.id,
        verifiedAt: new Date(),
      });
      await transaction.insert(externalIdentities).values({
        claims: input.claims,
        provider: input.provider,
        subject: input.subject,
        userId: user.id,
      });
      return {
        ...user,
        email: input.email,
        emailVerified: true,
      };
    });
  }

  async linkExternalIdentity(
    userId: string,
    sessionId: string,
    provider: string,
    subject: string,
    claims: Record<string, unknown>,
    now: Date,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const [user] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.status, 'active')))
        .for('update')
        .limit(1);
      const [session] = await transaction
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.id, sessionId),
            eq(sessions.userId, userId),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, now),
          ),
        )
        .for('update')
        .limit(1);
      if (!user || !session) {
        return false;
      }
      await transaction.insert(externalIdentities).values({
        claims,
        provider,
        subject,
        updatedAt: now,
        userId,
      });
      return true;
    });
  }
}

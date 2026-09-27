import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { personalAccessTokens, users } from '../database/schema/index.js';
import type { ApiTokenScope } from './developer-api.dto.js';

export interface ApiTokenRecord {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  lastUsedAt: Date | null;
  name: string;
  prefix: string;
  revokedAt: Date | null;
  scopes: ApiTokenScope[];
  userId: string;
}

interface StoredTokenInput {
  expiresAt: Date;
  name: string;
  prefix: string;
  scopes: ApiTokenScope[];
  tokenHash: string;
  userId: string;
}

interface RotatedTokenInput {
  expiresAt?: Date;
  prefix: string;
  tokenHash: string;
}

@Injectable()
export class DeveloperApiRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create(input: StoredTokenInput): Promise<ApiTokenRecord> {
    const [record] = await this.database
      .insert(personalAccessTokens)
      .values({
        expiresAt: input.expiresAt,
        name: input.name,
        scopes: input.scopes,
        tokenHash: input.tokenHash,
        tokenPrefix: input.prefix,
        userId: input.userId,
      })
      .returning(this.selection());
    if (!record) throw new Error('API token creation did not return a token.');
    return record as ApiTokenRecord;
  }

  async list(userId: string): Promise<ApiTokenRecord[]> {
    return this.database
      .select(this.selection())
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.userId, userId))
      .orderBy(desc(personalAccessTokens.createdAt), desc(personalAccessTokens.id)) as Promise<ApiTokenRecord[]>;
  }

  async findActiveByHash(tokenHash: string, now: Date): Promise<ApiTokenRecord | undefined> {
    const [record] = await this.database
      .select(this.selection())
      .from(personalAccessTokens)
      .innerJoin(users, eq(users.id, personalAccessTokens.userId))
      .where(and(
        eq(personalAccessTokens.tokenHash, tokenHash),
        isNull(personalAccessTokens.revokedAt),
        gt(personalAccessTokens.expiresAt, now),
        eq(users.status, 'active'),
      ))
      .limit(1);
    return record as ApiTokenRecord | undefined;
  }

  async revoke(userId: string, tokenId: string, now: Date): Promise<boolean> {
    const records = await this.database
      .update(personalAccessTokens)
      .set({ revokedAt: now })
      .where(and(
        eq(personalAccessTokens.id, tokenId),
        eq(personalAccessTokens.userId, userId),
        isNull(personalAccessTokens.revokedAt),
      ))
      .returning({ id: personalAccessTokens.id });
    return records.length > 0;
  }

  async rotate(
    userId: string,
    tokenId: string,
    input: RotatedTokenInput,
    now: Date,
  ): Promise<ApiTokenRecord | undefined> {
    return this.database.transaction(async (transaction) => {
      const [current] = await transaction
        .update(personalAccessTokens)
        .set({ revokedAt: now })
        .where(and(
          eq(personalAccessTokens.id, tokenId),
          eq(personalAccessTokens.userId, userId),
          isNull(personalAccessTokens.revokedAt),
          gt(personalAccessTokens.expiresAt, now),
        ))
        .returning({
          expiresAt: personalAccessTokens.expiresAt,
          name: personalAccessTokens.name,
          scopes: personalAccessTokens.scopes,
        });
      if (!current) return undefined;

      const [replacement] = await transaction
        .insert(personalAccessTokens)
        .values({
          expiresAt: input.expiresAt ?? current.expiresAt,
          name: current.name,
          scopes: current.scopes,
          tokenHash: input.tokenHash,
          tokenPrefix: input.prefix,
          userId,
        })
        .returning(this.selection());
      if (!replacement) {
        throw new Error('API token rotation did not return a token.');
      }
      return replacement as ApiTokenRecord;
    });
  }

  async touch(tokenId: string, now: Date): Promise<void> {
    await this.database
      .update(personalAccessTokens)
      .set({ lastUsedAt: now })
      .where(eq(personalAccessTokens.id, tokenId));
  }

  private selection() {
    return {
      createdAt: personalAccessTokens.createdAt,
      expiresAt: personalAccessTokens.expiresAt,
      id: personalAccessTokens.id,
      lastUsedAt: personalAccessTokens.lastUsedAt,
      name: personalAccessTokens.name,
      prefix: personalAccessTokens.tokenPrefix,
      revokedAt: personalAccessTokens.revokedAt,
      scopes: personalAccessTokens.scopes,
      userId: personalAccessTokens.userId,
    };
  }
}

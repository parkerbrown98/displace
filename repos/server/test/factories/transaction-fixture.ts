import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import type { Database } from '../../src/database/database.types.js';
import {
  placeMembers,
  places,
  users,
} from '../../src/database/schema/index.js';
import * as schema from '../../src/database/schema/index.js';

export class DatabaseFixture {
  constructor(readonly database: Database) {}

  async createUser(overrides: Partial<typeof users.$inferInsert> = {}) {
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    const [user] = await this.database
      .insert(users)
      .values({
        displayName: `Test User ${suffix}`,
        handle: `user_${suffix}`,
        ...overrides,
      })
      .returning();
    if (!user) {
      throw new Error('Fixture user was not returned.');
    }
    return user;
  }

  async createPlace(
    ownerUserId: string,
    overrides: Partial<typeof places.$inferInsert> = {},
  ) {
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    const [place] = await this.database
      .insert(places)
      .values({
        name: `Test Place ${suffix}`,
        ownerUserId,
        slug: `place-${suffix}`,
        ...overrides,
      })
      .returning();
    if (!place) {
      throw new Error('Fixture place was not returned.');
    }
    return place;
  }

  async createActiveMember(placeId: string, userId: string) {
    const [member] = await this.database
      .insert(placeMembers)
      .values({ joinedAt: new Date(), placeId, status: 'active', userId })
      .returning();
    if (!member) {
      throw new Error('Fixture member was not returned.');
    }
    return member;
  }
}

export async function withRollback<T>(
  pool: Pool,
  run: (fixture: DatabaseFixture) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    return await run(new DatabaseFixture(drizzle(client, { schema })));
  } finally {
    await client.query('rollback');
    client.release();
  }
}

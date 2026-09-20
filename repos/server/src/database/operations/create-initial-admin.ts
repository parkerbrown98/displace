import { argon2id, hash } from 'argon2';
import { and, eq, ne } from 'drizzle-orm';
import type { Database } from '../database.types.js';
import { userEmails, users } from '../schema/index.js';

export interface InitialAdminInput {
  displayName: string;
  email: string;
  handle: string;
  password: string;
}

export async function createInitialAdmin(
  database: Database,
  input: InitialAdminInput,
): Promise<string> {
  const passwordHash = await hash(input.password, {
    type: argon2id,
    memoryCost: 19_456,
    parallelism: 1,
    timeCost: 2,
  });

  return database.transaction(async (transaction) => {
    const [existingEmail] = await transaction
      .select({
        isPrimary: userEmails.isPrimary,
        status: users.status,
        userId: userEmails.userId,
        verifiedAt: userEmails.verifiedAt,
      })
      .from(userEmails)
      .innerJoin(users, eq(users.id, userEmails.userId))
      .where(eq(userEmails.email, input.email))
      .limit(1);

    if (existingEmail) {
      if (existingEmail.status !== 'active') {
        throw new Error(
          `Cannot promote a ${existingEmail.status} user to initial administrator.`,
        );
      }

      await transaction
        .update(users)
        .set({
          displayName: input.displayName,
          isInstanceAdmin: true,
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingEmail.userId));
      if (!existingEmail.isPrimary) {
        await transaction
          .update(userEmails)
          .set({ isPrimary: false })
          .where(
            and(
              eq(userEmails.userId, existingEmail.userId),
              ne(userEmails.email, input.email),
            ),
          );
      }
      if (!existingEmail.isPrimary || !existingEmail.verifiedAt) {
        await transaction
          .update(userEmails)
          .set({
            isPrimary: true,
            verifiedAt: existingEmail.verifiedAt ?? new Date(),
          })
          .where(eq(userEmails.email, input.email));
      }
      return existingEmail.userId;
    }

    const [user] = await transaction
      .insert(users)
      .values({
        displayName: input.displayName,
        handle: input.handle,
        isInstanceAdmin: true,
        passwordHash,
      })
      .returning({ id: users.id });
    if (!user) {
      throw new Error('Initial administrator creation returned no user.');
    }
    await transaction.insert(userEmails).values({
      email: input.email,
      isPrimary: true,
      userId: user.id,
      verifiedAt: new Date(),
    });
    return user.id;
  });
}

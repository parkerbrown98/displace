import { sql } from 'drizzle-orm';

export const uuidV7Default = sql`uuidv7()`;
export const emptyJsonObject = sql`'{}'::jsonb`;

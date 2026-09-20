import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';

const postgresUrl = z
  .url()
  .refine(
    (value) => {
      const protocol = new URL(value).protocol;
      return protocol === 'postgres:' || protocol === 'postgresql:';
    },
    { message: 'must use postgres: or postgresql:' },
  )
  .refine((value) => new URL(value).pathname.length > 1, {
    message: 'must include an explicit database name',
  });

const databaseCliEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_URL: postgresUrl.default(
      'postgresql://displace_app:displace_app_dev@localhost:5432/displace',
    ),
    DATABASE_MIGRATION_URL: postgresUrl.default(
      'postgresql://displace:displace_dev@localhost:5432/displace',
    ),
  })
  .superRefine((environment, context) => {
    const runtimeUrl = new URL(environment.DATABASE_URL);
    const migrationUrl = new URL(environment.DATABASE_MIGRATION_URL);
    const runtimeUser = decodeURIComponent(runtimeUrl.username);
    const migrationUser = decodeURIComponent(migrationUrl.username);
    if (!runtimeUser || !migrationUser || runtimeUser === migrationUser) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'Migration and runtime database roles must be distinct.',
      });
    }

    const runtimeTarget = [
      runtimeUrl.hostname,
      runtimeUrl.port || '5432',
      decodeURIComponent(runtimeUrl.pathname),
    ];
    const migrationTarget = [
      migrationUrl.hostname,
      migrationUrl.port || '5432',
      decodeURIComponent(migrationUrl.pathname),
    ];
    if (
      runtimeTarget.some((value, index) => value !== migrationTarget[index])
    ) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_MIGRATION_URL'],
        message:
          'Migration and runtime URLs must target the same host, port, and database.',
      });
    }
  });

export type DatabaseCliEnvironment = z.infer<
  typeof databaseCliEnvironmentSchema
>;

export function getDatabaseTarget(value: string): string {
  const url = new URL(value);
  const hostname = url.hostname.includes(':')
    ? `[${url.hostname}]`
    : url.hostname;
  return `${hostname}:${url.port || '5432'}/${decodeURIComponent(url.pathname.slice(1))}`;
}

export function loadRepositoryEnvironment(): void {
  for (const path of [resolve('../../.env'), resolve('.env')]) {
    if (existsSync(path)) {
      loadEnvFile(path);
    }
  }
}

export function getDatabaseCliEnvironment(): DatabaseCliEnvironment {
  loadRepositoryEnvironment();
  return parseDatabaseCliEnvironment(process.env);
}

export function parseDatabaseCliEnvironment(
  input: NodeJS.ProcessEnv,
): DatabaseCliEnvironment {
  const result = databaseCliEnvironmentSchema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  throw new Error(
    `Invalid database CLI configuration: ${result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}`,
  );
}

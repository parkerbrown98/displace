import {
  getDatabaseTarget,
  parseDatabaseCliEnvironment,
} from './environment.js';

describe('parseDatabaseCliEnvironment', () => {
  it('accepts distinct roles for the same PostgreSQL target', () => {
    expect(
      parseDatabaseCliEnvironment({
        DATABASE_MIGRATION_URL:
          'postgresql://owner:owner-password@database/displace',
        DATABASE_URL:
          'postgresql://runtime:runtime-password@database:5432/displace',
      }),
    ).toMatchObject({ NODE_ENV: 'development' });
  });

  it('rejects URLs for different PostgreSQL targets', () => {
    expect(() =>
      parseDatabaseCliEnvironment({
        DATABASE_MIGRATION_URL:
          'postgresql://owner:owner-password@database/displace_admin',
        DATABASE_URL: 'postgresql://runtime:runtime-password@database/displace',
      }),
    ).toThrow(/must target the same host, port, and database/);
  });

  it('rejects URLs without explicit database names', () => {
    expect(() =>
      parseDatabaseCliEnvironment({
        DATABASE_MIGRATION_URL: 'postgresql://owner:owner-password@database',
        DATABASE_URL: 'postgresql://runtime:runtime-password@database',
      }),
    ).toThrow(/must include an explicit database name/);
  });

  it('builds a reset confirmation from the exact database target', () => {
    expect(
      getDatabaseTarget(
        'postgresql://owner:password@database.example:5544/displace_test',
      ),
    ).toBe('database.example:5544/displace_test');
  });
});

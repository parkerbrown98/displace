import { validateEnvironment } from './environment.js';

describe('validateEnvironment', () => {
  it('normalizes development values', () => {
    const environment = validateEnvironment({
      CORS_ORIGINS: 'http://localhost:3000, http://localhost:3002',
      SINGLE_PLACE_MODE: 'true',
      SINGLE_PLACE_SLUG: 'game-makers',
      TRUST_PROXY: 'loopback, 10.0.0.0/8',
    });

    expect(environment.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'http://localhost:3002',
    ]);
    expect(environment.SINGLE_PLACE_MODE).toBe(true);
    expect(environment.TRUST_PROXY).toEqual(['loopback', '10.0.0.0/8']);
    expect(environment.UPLOAD_ALLOWED_MIME_TYPES).toContain('image/png');
  });

  it('rejects development secrets in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        PUBLIC_URL: 'https://displace.example',
      }),
    ).toThrow(/must be changed in production/);
  });

  it('requires SMTP delivery in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        PUBLIC_URL: 'https://displace.example',
      }),
    ).toThrow(/SMTP_HOST is required in production/);
  });

  it('requires a complete OIDC configuration', () => {
    expect(() =>
      validateEnvironment({ OIDC_ISSUER_URL: 'https://identity.example' }),
    ).toThrow(/All OIDC settings are required/);
  });

  it('requires a configured scanner when malware scanning is mandatory', () => {
    expect(() =>
      validateEnvironment({ MALWARE_SCANNER_REQUIRED: 'true' }),
    ).toThrow(/MALWARE_SCANNER_URL is required/);
  });

  it('rejects incompatible service URLs and non-origin CORS values', () => {
    expect(() =>
      validateEnvironment({ REDIS_URL: 'https://redis.example' }),
    ).toThrow(/URL must use one of these protocols/);
    expect(() =>
      validateEnvironment({ CORS_ORIGINS: 'https://web.example/path' }),
    ).toThrow(/CORS origin must contain only an HTTP\(S\) origin/);
  });
});

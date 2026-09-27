import { describe, expect, it } from 'vitest';
import { readAppConfig } from './app-config';

const productionConfig = {
  VITE_API_ORIGIN: 'https://api.displace.example',
  VITE_LIVEKIT_ORIGIN: 'wss://voice.displace.example',
  VITE_OIDC_CALLBACK_SCHEME: 'displace',
  VITE_RELEASE_CHANNEL: 'stable',
  VITE_TELEMETRY_ENDPOINT: 'https://telemetry.displace.example/events',
  VITE_UPDATER_ENDPOINT: 'https://updates.displace.example/stable.json',
  VITE_UPDATER_PUBLIC_KEY: 'public-key',
};

describe('readAppConfig', () => {
  it('normalizes valid production configuration', () => {
    expect(readAppConfig(productionConfig, 'production')).toMatchObject({
      apiOrigin: 'https://api.displace.example',
      liveKitOrigin: 'wss://voice.displace.example',
      releaseChannel: 'stable',
    });
  });

  it('rejects insecure production services', () => {
    expect(() =>
      readAppConfig({ ...productionConfig, VITE_API_ORIGIN: 'http://api.displace.example' }, 'production'),
    ).toThrow('VITE_API_ORIGIN must be an HTTPS origin');
  });

  it('rejects web callback schemes', () => {
    expect(() =>
      readAppConfig({ ...productionConfig, VITE_OIDC_CALLBACK_SCHEME: 'https' }, 'production'),
    ).toThrow('must be a lowercase custom URL scheme');
  });

  it('requires updater endpoint and key together', () => {
    expect(() =>
      readAppConfig({ ...productionConfig, VITE_UPDATER_PUBLIC_KEY: '' }, 'production'),
    ).toThrow('must be configured together');
  });

  it('provides local development defaults', () => {
    expect(readAppConfig({}, 'development')).toMatchObject({
      apiOrigin: 'http://localhost:3001',
      liveKitOrigin: 'ws://localhost:7880',
      oidcCallbackScheme: 'displace-dev',
    });
  });
});
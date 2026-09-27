export type ReleaseChannel = 'development' | 'nightly' | 'beta' | 'stable';

export interface AppConfig {
  apiOrigin: string;
  liveKitOrigin: string;
  oidcCallbackScheme: string;
  updaterEndpoint: string | null;
  updaterPublicKey: string | null;
  releaseChannel: ReleaseChannel;
  telemetryEndpoint: string | null;
}

type ConfigSource = Record<string, string | undefined>;

const developmentDefaults: Required<ConfigSource> = {
  VITE_API_ORIGIN: 'http://localhost:3001',
  VITE_LIVEKIT_ORIGIN: 'ws://localhost:7880',
  VITE_OIDC_CALLBACK_SCHEME: 'displace-dev',
  VITE_RELEASE_CHANNEL: 'development',
  VITE_TELEMETRY_ENDPOINT: '',
  VITE_UPDATER_ENDPOINT: '',
  VITE_UPDATER_PUBLIC_KEY: '',
};

export function readAppConfig(
  source: ConfigSource,
  mode: string = 'development',
): AppConfig {
  const values = mode === 'production' ? source : { ...developmentDefaults, ...source };
  const apiOrigin = required(values, 'VITE_API_ORIGIN');
  const liveKitOrigin = required(values, 'VITE_LIVEKIT_ORIGIN');
  const oidcCallbackScheme = required(values, 'VITE_OIDC_CALLBACK_SCHEME');
  const releaseChannel = required(values, 'VITE_RELEASE_CHANNEL');
  const updaterEndpoint = optional(values.VITE_UPDATER_ENDPOINT);
  const updaterPublicKey = optional(values.VITE_UPDATER_PUBLIC_KEY);
  const telemetryEndpoint = optional(values.VITE_TELEMETRY_ENDPOINT);

  validateHttpOrigin(apiOrigin, 'VITE_API_ORIGIN', mode);
  validateLiveKitOrigin(liveKitOrigin, mode);
  validateCallbackScheme(oidcCallbackScheme);
  validateReleaseChannel(releaseChannel);

  if ((updaterEndpoint === null) !== (updaterPublicKey === null)) {
    throw new Error('VITE_UPDATER_ENDPOINT and VITE_UPDATER_PUBLIC_KEY must be configured together.');
  }
  if (updaterEndpoint) validateHttpsUrl(updaterEndpoint, 'VITE_UPDATER_ENDPOINT');
  if (telemetryEndpoint) validateHttpsUrl(telemetryEndpoint, 'VITE_TELEMETRY_ENDPOINT');

  return {
    apiOrigin: stripTrailingSlash(apiOrigin),
    liveKitOrigin: stripTrailingSlash(liveKitOrigin),
    oidcCallbackScheme,
    updaterEndpoint,
    updaterPublicKey,
    releaseChannel,
    telemetryEndpoint,
  };
}

export function loadAppConfig(): AppConfig {
  return readAppConfig(import.meta.env, import.meta.env.MODE);
}

function required(source: ConfigSource, name: string): string {
  const value = source[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optional(value: string | undefined): string | null {
  return value?.trim() || null;
}

function validateHttpOrigin(value: string, name: string, mode: string): void {
  const url = parseUrl(value, name);
  const localDevelopment = mode !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.origin !== value.replace(/\/$/, '') || (url.protocol !== 'https:' && !localDevelopment)) {
    throw new Error(`${name} must be an HTTPS origin${mode === 'production' ? '' : ' or a local development origin'}.`);
  }
}

function validateLiveKitOrigin(value: string, mode: string): void {
  const url = parseUrl(value, 'VITE_LIVEKIT_ORIGIN');
  const localDevelopment = mode !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (!['wss:', 'https:'].includes(url.protocol) && !(localDevelopment && url.protocol === 'ws:')) {
    throw new Error('VITE_LIVEKIT_ORIGIN must use WSS or HTTPS.');
  }
}

function validateCallbackScheme(value: string): void {
  if (!/^[a-z][a-z0-9+.-]*$/.test(value) || ['http', 'https'].includes(value)) {
    throw new Error('VITE_OIDC_CALLBACK_SCHEME must be a lowercase custom URL scheme.');
  }
}

function validateReleaseChannel(value: string): asserts value is ReleaseChannel {
  if (!['development', 'nightly', 'beta', 'stable'].includes(value)) {
    throw new Error('VITE_RELEASE_CHANNEL must be development, nightly, beta, or stable.');
  }
}

function validateHttpsUrl(value: string, name: string): void {
  if (parseUrl(value, name).protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS.`);
  }
}

function parseUrl(value: string, name: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}
import { invoke } from '@tauri-apps/api/core';
import type { components } from '@displace/api-client';
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { open } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { check, type Update } from '@tauri-apps/plugin-updater';

type NativeAuthentication = Omit<components['schemas']['AuthenticationDto'], 'refreshToken'>;

export interface AppMetadata {
  architecture: string;
  name: string;
  platform: string;
  version: string;
}

export interface DiagnosticSnapshot extends AppMetadata {
  secureStorageAvailable: boolean;
}

export interface AvailableUpdate {
  currentVersion: string;
  version: string;
}

export interface UpdateProgress {
  contentLength?: number;
  downloaded: number;
}

export type Unlisten = () => void;

export interface OidcTransactionStart {
  callbackUrl: string;
  codeChallenge: string;
  nonce: string;
  state: string;
}

export interface OidcTransactionCompletion {
  callbackUrl: string;
  codeVerifier: string;
  nonce: string;
  state: string;
}

export interface NativePlatform {
  beginOidcTransaction(callbackScheme: string): Promise<OidcTransactionStart>;
  clearRefreshToken(): Promise<void>;
  collectDiagnostics(): Promise<DiagnosticSnapshot>;
  getAppMetadata(): Promise<AppMetadata>;
  hasRefreshToken(): Promise<boolean>;
  refreshAuthentication(apiOrigin: string): Promise<NativeAuthentication | null>;
  installAvailableUpdate(onProgress?: (progress: UpdateProgress) => void): Promise<void>;
  listenForDeepLinks(listener: (urls: string[]) => void): Promise<Unlisten>;
  completeOidcAuthentication(callbackUrl: string, callbackScheme: string, apiOrigin: string): Promise<NativeAuthentication>;
  notify(title: string, body: string): Promise<boolean>;
  selectUploadFiles(): Promise<string[]>;
  openExternalUrl(url: string): Promise<void>;
  storeRefreshToken(refreshToken: string): Promise<void>;
  checkForUpdate(): Promise<AvailableUpdate | null>;
}

export function createNativePlatform(): NativePlatform {
  let pendingUpdate: Update | null = null;

  return {
    beginOidcTransaction: (callbackScheme) => invoke('begin_oidc_transaction', { callbackScheme }),
    async checkForUpdate() {
      pendingUpdate = await check();
      return pendingUpdate
        ? { currentVersion: pendingUpdate.currentVersion, version: pendingUpdate.version }
        : null;
    },
    clearRefreshToken: () => invoke('clear_refresh_token'),
    collectDiagnostics: () => invoke('collect_diagnostics'),
    getAppMetadata: () => invoke('get_app_metadata'),
    hasRefreshToken: () => invoke('has_refresh_token'),
    refreshAuthentication: (apiOrigin) => invoke('refresh_authentication', { apiOrigin }),
    async installAvailableUpdate(onProgress) {
      if (!pendingUpdate) throw new Error('No verified update is ready to install.');
      let downloaded = 0;
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          onProgress?.({ contentLength: event.data.contentLength, downloaded: 0 });
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          onProgress?.({ downloaded });
        }
      });
      pendingUpdate = null;
    },
    async listenForDeepLinks(listener) {
      const seen = new Set<string>();
      const dispatch = (urls: string[]) => {
        const unseen = urls.filter((url) => !seen.has(url));
        unseen.forEach((url) => seen.add(url));
        if (unseen.length > 0) listener(unseen);
      };
      const unlisten = await onOpenUrl(dispatch);
      dispatch((await getCurrent()) ?? []);
      return unlisten;
    },
    completeOidcAuthentication: (callbackUrl, callbackScheme, apiOrigin) => invoke('complete_oidc_authentication', { apiOrigin, callbackScheme, callbackUrl }),
    async notify(title, body) {
      let allowed = await isPermissionGranted();
      if (!allowed) allowed = (await requestPermission()) === 'granted';
      if (allowed) sendNotification({ title, body });
      return allowed;
    },
    async selectUploadFiles() {
      const selection = await open({ directory: false, multiple: true });
      if (!selection) return [];
      return Array.isArray(selection) ? selection : [selection];
    },
    openExternalUrl: openUrl,
    storeRefreshToken: (refreshToken) => invoke('store_refresh_token', { refreshToken }),
  };
}

export class MemoryNativePlatform implements NativePlatform {
  #refreshToken: string | null = null;
  #oidcTransaction: OidcTransactionCompletion | null = null;

  constructor(private readonly fetchImplementation: typeof fetch = fetch) {}

  async beginOidcTransaction(callbackScheme: string): Promise<OidcTransactionStart> {
    const value = crypto.randomUUID().replaceAll('-', '').padEnd(43, '0');
    this.#oidcTransaction = {
      callbackUrl: `${callbackScheme}://auth/callback`,
      codeVerifier: value,
      nonce: value,
      state: value,
    };
    return { callbackUrl: this.#oidcTransaction.callbackUrl, codeChallenge: value, nonce: value, state: value };
  }

  async checkForUpdate(): Promise<AvailableUpdate | null> {
    return null;
  }

  async clearRefreshToken(): Promise<void> {
    this.#refreshToken = null;
  }

  async collectDiagnostics(): Promise<DiagnosticSnapshot> {
    return { ...(await this.getAppMetadata()), secureStorageAvailable: true };
  }

  async getAppMetadata(): Promise<AppMetadata> {
    return { architecture: 'test', name: 'Displace', platform: 'test', version: '0.1.0-test' };
  }

  async hasRefreshToken(): Promise<boolean> {
    return this.#refreshToken !== null;
  }

  async inspectRefreshToken(): Promise<string | null> {
    return this.#refreshToken;
  }

  async refreshAuthentication(apiOrigin: string): Promise<NativeAuthentication | null> {
    if (!this.#refreshToken) return null;
    const response = await this.fetchImplementation(new URL('/api/v1/auth/refresh', apiOrigin), {
      body: JSON.stringify({ refreshToken: this.#refreshToken, refreshTokenDelivery: 'response_body' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if ([401, 403].includes(response.status)) {
      this.#refreshToken = null;
      return null;
    }
    if (!response.ok) throw new Error('The authentication request failed.');
    const authentication = await response.json() as components['schemas']['AuthenticationDto'];
    this.#refreshToken = authentication.refreshToken ?? null;
    return withoutRefreshToken(authentication);
  }

  async installAvailableUpdate(): Promise<void> {
    throw new Error('No verified update is ready to install.');
  }

  async listenForDeepLinks(): Promise<Unlisten> {
    return () => undefined;
  }

  async completeOidcAuthentication(callbackUrl: string, callbackScheme: string, apiOrigin: string): Promise<NativeAuthentication> {
    const transaction = this.#oidcTransaction;
    this.#oidcTransaction = null;
    const callback = new URL(callbackUrl);
    if (!transaction || callback.protocol !== `${callbackScheme}:` || callback.host !== 'auth' || callback.pathname !== '/callback' || callback.searchParams.get('state') !== transaction.state || !callback.searchParams.get('code')) {
      throw new Error('The sign-in response is invalid or expired.');
    }
    const response = await this.fetchImplementation(new URL('/api/v1/auth/oidc/native/exchange', apiOrigin), {
      body: JSON.stringify({ ...transaction, callbackUrl }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!response.ok) throw new Error('The authentication request failed.');
    const authentication = await response.json() as components['schemas']['AuthenticationDto'];
    this.#refreshToken = authentication.refreshToken ?? null;
    return withoutRefreshToken(authentication);
  }

  async notify(): Promise<boolean> {
    return true;
  }

  async openExternalUrl(url: string): Promise<void> {
    void url;
  }

  async selectUploadFiles(): Promise<string[]> {
    return [];
  }

  async storeRefreshToken(refreshToken: string): Promise<void> {
    this.#refreshToken = refreshToken;
  }
}

function withoutRefreshToken(authentication: components['schemas']['AuthenticationDto']): NativeAuthentication {
  const session = { ...authentication };
  delete session.refreshToken;
  return session;
}
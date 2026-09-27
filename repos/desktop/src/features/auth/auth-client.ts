import type { components } from '@displace/api-client';
import type { AppConfig } from '../../config/app-config';
import { createDesktopApi, DesktopApiError, normalizeApiError, type DesktopApi } from '../../lib/api/desktop-api';
import { desktopReadCache } from '../../lib/api/read-cache';
import type { NativePlatform } from '../../lib/platform/native-platform';

export type AccountSession = components['schemas']['SessionDto'];
export type Authentication = components['schemas']['AuthenticationDto'];
export type NativeAuthentication = Omit<Authentication, 'refreshToken'>;
export type MessageResponse = components['schemas']['MessageDto'];
export type RegisterInput = components['schemas']['RegisterDto'];
export type SignInInput = Pick<components['schemas']['LoginDto'], 'identifier' | 'password'>;
export type UserProfile = components['schemas']['UserProfileDto'];

export class NativeAuthClient {
  readonly api: DesktopApi;
  #accessToken: string | null = null;
  #invalidationListeners = new Set<() => void>();
  #refreshRequest: Promise<NativeAuthentication | null> | null = null;
  #user: UserProfile | null = null;

  constructor(
    private readonly config: Pick<AppConfig, 'apiOrigin' | 'oidcCallbackScheme'>,
    private readonly platform: NativePlatform,
    fetchImplementation?: typeof fetch,
  ) {
    this.api = createDesktopApi({
      config,
      fetchImplementation,
      getAccessToken: () => this.#accessToken,
    });
  }

  get user(): UserProfile | null {
    return this.#user;
  }

  onSessionInvalidated(listener: () => void): () => void {
    this.#invalidationListeners.add(listener);
    return () => this.#invalidationListeners.delete(listener);
  }

  async initialize(): Promise<NativeAuthentication | null> {
    return this.refreshAuthentication();
  }

  async register(input: RegisterInput): Promise<MessageResponse> {
    return this.api.request('/api/v1/auth/register', { body: input, method: 'POST' });
  }

  async verifyEmail(token: string): Promise<void> {
    return this.api.request('/api/v1/auth/email/verify', { body: { token }, method: 'POST' });
  }

  async signIn(input: SignInInput, persist = true): Promise<Authentication> {
    const authentication = await this.api.request<Authentication>('/api/v1/auth/login', {
      body: { ...input, refreshTokenDelivery: 'response_body' },
      method: 'POST',
    });
    await this.remember(authentication, persist);
    return authentication;
  }

  async beginOidcSignIn(): Promise<void> {
    const transaction = await this.platform.beginOidcTransaction(this.config.oidcCallbackScheme);
    const authorization = new URL('/api/v1/auth/oidc/native/authorize', this.config.apiOrigin);
    authorization.search = new URLSearchParams({
      codeChallenge: transaction.codeChallenge,
      nonce: transaction.nonce,
      state: transaction.state,
    }).toString();
    await this.platform.openExternalUrl(authorization.toString());
  }

  async completeOidcSignIn(callbackUrl: string): Promise<NativeAuthentication> {
    const authentication = await this.platform.completeOidcAuthentication(
      callbackUrl,
      this.config.oidcCallbackScheme,
      this.config.apiOrigin,
    );
    this.rememberSession(authentication);
    return authentication;
  }

  listenForOidcCallbacks(listener: (callbackUrl: string) => void): Promise<() => void> {
    return this.platform.listenForDeepLinks((urls) => {
      for (const url of urls) {
        try {
          const callback = new URL(url);
          if (callback.protocol === `${this.config.oidcCallbackScheme}:` && callback.host === 'auth' && callback.pathname === '/callback') listener(url);
        } catch {
          // Unrelated malformed deep links are ignored at this boundary.
        }
      }
    });
  }

  refreshAuthentication(): Promise<NativeAuthentication | null> {
    if (this.#refreshRequest) return this.#refreshRequest;
    this.#refreshRequest = this.performRefresh().finally(() => {
      this.#refreshRequest = null;
    });
    return this.#refreshRequest;
  }

  async forgotPassword(email: string): Promise<MessageResponse> {
    return this.api.request('/api/v1/auth/password/forgot', {
      body: { email },
      method: 'POST',
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    return this.api.request('/api/v1/auth/password/reset', {
      body: { password, token },
      method: 'POST',
    });
  }

  async getCurrentProfile(): Promise<UserProfile> {
    const profile = await this.authenticatedRequest<UserProfile>('/api/v1/auth/me');
    this.#user = profile;
    return profile;
  }

  async updateProfile(input: Pick<UserProfile, 'displayName' | 'handle'>): Promise<UserProfile> {
    const profile = await this.authenticatedRequest<UserProfile>('/api/v1/auth/me', {
      body: input,
      method: 'PATCH',
    });
    this.#user = profile;
    return profile;
  }

  async changeEmail(email: string): Promise<MessageResponse> {
    return this.authenticatedRequest('/api/v1/auth/email/change', {
      body: { email },
      method: 'POST',
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.authenticatedRequest('/api/v1/auth/password/change', {
      body: { currentPassword, newPassword },
      method: 'POST',
    });
  }

  async listSessions(): Promise<AccountSession[]> {
    return this.authenticatedRequest('/api/v1/auth/sessions');
  }

  async revokeSession(sessionId: string): Promise<void> {
    return this.authenticatedRequest(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  }

  async signOut(all = false): Promise<void> {
    try {
      if (this.#accessToken || (await this.platform.hasRefreshToken())) {
        await this.authenticatedRequest<void>(
          all ? '/api/v1/auth/logout-all' : '/api/v1/auth/logout',
          { method: 'POST' },
          false,
        );
      }
    } finally {
      await this.forget();
    }
  }

  async authenticatedRequest<T>(
    path: string,
    options: Parameters<DesktopApi['request']>[1] = {},
    retry = true,
  ): Promise<T> {
    if (!this.#accessToken && !(await this.refreshAuthentication())) {
      throw new DesktopApiError('unauthenticated');
    }
    try {
      return await this.api.request<T>(path, options);
    } catch (error) {
      if (!retry || !(error instanceof DesktopApiError) || error.kind !== 'unauthenticated') {
        throw error;
      }
      this.#accessToken = null;
      if (!(await this.refreshAuthentication())) throw error;
      return this.authenticatedRequest<T>(path, options, false);
    }
  }

  private async performRefresh(): Promise<NativeAuthentication | null> {
    if (!(await this.platform.hasRefreshToken())) return null;
    try {
      const authentication = await this.platform.refreshAuthentication(this.config.apiOrigin);
      if (!authentication) {
        await this.forget(true);
        return null;
      }
      this.rememberSession(authentication);
      return authentication;
    } catch (error) {
      throw normalizeNativeAuthError(error);
    }
  }

  private async remember(authentication: Authentication, persist: boolean): Promise<void> {
    if (persist) {
      if (!authentication.refreshToken) {
        throw new Error('The server did not return a native refresh token.');
      }
      await this.platform.storeRefreshToken(authentication.refreshToken);
    } else {
      await this.platform.clearRefreshToken();
    }
    this.rememberSession(authentication);
  }

  private rememberSession(authentication: NativeAuthentication): void {
    this.#accessToken = authentication.accessToken;
    this.#user = authentication.user;
  }

  private async forget(notify = false): Promise<void> {
    this.#accessToken = null;
    this.#user = null;
    desktopReadCache.clearSensitive();
    await this.platform.clearRefreshToken();
    if (notify) this.#invalidationListeners.forEach((listener) => listener());
  }
}

export function authErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof DesktopApiError)) return fallback;
  if (error.kind === 'offline') return 'Displace is offline. Check your connection and try again.';
  if (error.kind === 'rate-limited') return 'Too many attempts. Wait a moment and try again.';
  return error.problem?.detail ?? fallback;
}

function normalizeNativeAuthError(error: unknown): DesktopApiError {
  if (typeof error === 'object' && error !== null && 'kind' in error) {
    const kind = String(error.kind);
    if (['offline', 'unauthenticated', 'forbidden', 'not-found', 'gone', 'rate-limited', 'server', 'unknown'].includes(kind)) {
      return new DesktopApiError(kind as DesktopApiError['kind']);
    }
  }
  return normalizeApiError(error);
}
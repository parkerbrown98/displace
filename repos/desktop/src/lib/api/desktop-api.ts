import {
  ApiError,
  createApiClient,
  requestJson,
  withCursor,
  type DisplaceApiClient,
  type JsonRequestOptions,
  type ProblemDetails,
} from '@displace/api-client/http';
import type { AppConfig } from '../../config/app-config';

export type ApiFailureKind =
  | 'offline'
  | 'unauthenticated'
  | 'forbidden'
  | 'not-found'
  | 'rate-limited'
  | 'server'
  | 'unknown';

export class DesktopApiError extends Error {
  constructor(
    readonly kind: ApiFailureKind,
    readonly problem?: ProblemDetails,
    options?: ErrorOptions,
  ) {
    super(problem?.detail ?? problem?.title ?? messageFor(kind), options);
    this.name = 'DesktopApiError';
  }

  get requestId(): string | undefined {
    return this.problem?.requestId;
  }
}

export interface DesktopApi {
  readonly client: DisplaceApiClient;
  createCommandId(): string;
  createIdempotencyKey(): string;
  pagePath(path: string, cursor?: string, parameters?: Record<string, string | undefined>): string;
  request<T>(path: string, options?: JsonRequestOptions): Promise<T>;
  run<T>(operation: Promise<T>): Promise<T>;
}

export interface DesktopApiOptions {
  config: Pick<AppConfig, 'apiOrigin'>;
  fetchImplementation?: typeof fetch;
  getAccessToken: () => string | null;
}

export function createDesktopApi(options: DesktopApiOptions): DesktopApi {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const authenticatedFetch: typeof fetch = (input, init = {}) => {
    const headers = new Headers(init.headers);
    const accessToken = options.getAccessToken();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetchImplementation(input, { ...init, headers });
  };
  const client = createApiClient({
    baseUrl: options.config.apiOrigin,
    fetch: authenticatedFetch,
    createRequestId: createOpaqueId,
  });

  async function run<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch (error) {
      throw normalizeApiError(error);
    }
  }

  return {
    client,
    createCommandId: createOpaqueId,
    createIdempotencyKey: createOpaqueId,
    pagePath: withCursor,
    request<T>(path: string, requestOptions: JsonRequestOptions = {}) {
      return run(
        requestJson<T>(options.config.apiOrigin, path, {
          ...requestOptions,
          fetchImplementation: authenticatedFetch,
        }),
      );
    },
    run,
  };
}

export function normalizeApiError(error: unknown): DesktopApiError {
  if (error instanceof DesktopApiError) return error;
  if (error instanceof ApiError) {
    return new DesktopApiError(kindForStatus(error.problem.status), error.problem, { cause: error });
  }
  if (error instanceof TypeError || (error instanceof DOMException && error.name === 'NetworkError')) {
    return new DesktopApiError('offline', undefined, { cause: error });
  }
  return new DesktopApiError('unknown', undefined, { cause: error });
}

function createOpaqueId(): string {
  return crypto.randomUUID();
}

function kindForStatus(status: number): ApiFailureKind {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 429) return 'rate-limited';
  return status >= 500 ? 'server' : 'unknown';
}

function messageFor(kind: ApiFailureKind): string {
  const messages: Record<ApiFailureKind, string> = {
    offline: 'Displace could not reach the server.',
    unauthenticated: 'Your session has expired.',
    forbidden: 'You no longer have access to this resource.',
    'not-found': 'This resource could not be found.',
    'rate-limited': 'Too many requests were sent.',
    server: 'The server could not complete the request.',
    unknown: 'The request could not be completed.',
  };
  return messages[kind];
}
import createOpenApiClient, {
  type Client,
  type ClientOptions,
} from 'openapi-fetch';
import type { components, paths } from './schema.js';

type GeneratedProblemDetails = components['schemas']['ProblemDetailsDto'];

export type ProblemDetails = Pick<GeneratedProblemDetails, 'status' | 'title'> &
  Partial<Omit<GeneratedProblemDetails, 'status' | 'title'>>;

export class ApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.problem = problem;
  }
}

export interface JsonRequestOptions
  extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  csrfToken?: string;
  fetchImplementation?: typeof fetch;
  headers?: HeadersInit;
  idempotencyKey?: string;
  requestId?: string;
}

export interface DisplaceApiClientOptions extends ClientOptions {
  createRequestId?: () => string | undefined;
}

export type DisplaceApiClient = Client<paths>;

export function createApiClient(
  options: DisplaceApiClientOptions = {},
): DisplaceApiClient {
  const { createRequestId = defaultRequestId, ...clientOptions } = options;
  const client = createOpenApiClient<paths>(clientOptions);

  client.use({
    onRequest({ request }) {
      request.headers.set('Accept', 'application/json');
      const requestId = createRequestId();
      if (requestId && !request.headers.has('X-Request-Id')) {
        request.headers.set('X-Request-Id', requestId);
      }
      return request;
    },
    async onResponse({ response }) {
      if (!response.ok) {
        throw new ApiError(await readProblemDetails(response));
      }
      return response;
    },
  });

  return client;
}

export async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: JsonRequestOptions = {},
): Promise<T> {
  const {
    body,
    csrfToken,
    fetchImplementation = fetch,
    headers: initialHeaders,
    idempotencyKey,
    requestId = defaultRequestId(),
    ...requestOptions
  } = options;
  const headers = new Headers(initialHeaders);

  headers.set('Accept', 'application/json');
  if (requestId) headers.set('X-Request-Id', requestId);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);

  const response = await fetchImplementation(joinApiUrl(baseUrl, path), {
    ...requestOptions,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });

  if (!response.ok) {
    throw new ApiError(await readProblemDetails(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function readProblemDetails(
  response: Response,
): Promise<ProblemDetails> {
  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  const contentType = response.headers.get('Content-Type') ?? '';

  if (
    contentType.includes('application/json') ||
    contentType.includes('application/problem+json')
  ) {
    try {
      const value: unknown = await response.json();
      if (isProblemDetails(value)) {
        return { ...value, requestId: value.requestId ?? requestId };
      }
    } catch {
      // Fall through to a status-based problem when the response is malformed.
    }
  }

  return {
    requestId,
    status: response.status,
    title: response.statusText || 'Request failed',
  };
}

export function withCursor(
  path: string,
  cursor?: string,
  additionalParameters: Record<string, string | undefined> = {},
): string {
  const url = new URL(path, 'https://displace.invalid');
  if (cursor) url.searchParams.set('cursor', cursor);
  for (const [name, value] of Object.entries(additionalParameters)) {
    if (value !== undefined) url.searchParams.set(name, value);
  }
  return `${url.pathname}${url.search}`;
}

function defaultRequestId(): string | undefined {
  return globalThis.crypto?.randomUUID?.();
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProblemDetails>;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.status === 'number'
  );
}

function joinApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
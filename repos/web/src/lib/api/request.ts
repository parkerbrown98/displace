import { ApiError, readProblemDetails } from "./problem-details";

export type ApiAudience = "browser" | "public-server";

export interface ApiRequestOptions extends Omit<RequestInit, "body" | "headers"> {
  body?: unknown;
  csrfToken?: string;
  fetchImplementation?: typeof fetch;
  headers?: HeadersInit;
  idempotencyKey?: string;
  requestId?: string;
}

export async function apiRequest<T>(
  audience: ApiAudience,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    body,
    csrfToken,
    fetchImplementation = fetch,
    headers: initialHeaders,
    idempotencyKey,
    requestId = crypto.randomUUID(),
    ...requestOptions
  } = options;
  const headers = new Headers(initialHeaders);

  headers.set("Accept", "application/json");
  headers.set("X-Request-Id", requestId);
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  if (idempotencyKey) {
    headers.set("Idempotency-Key", idempotencyKey);
  }

  const response = await fetchImplementation(resolveApiUrl(audience, path), {
    ...requestOptions,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: audience === "browser" ? "include" : "omit",
    headers,
  });

  if (!response.ok) {
    throw new ApiError(await readProblemDetails(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function resolveApiUrl(audience: ApiAudience, path: string): string {
  const publicBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
  const baseUrl =
    audience === "public-server"
      ? process.env.API_INTERNAL_URL ?? publicBaseUrl
      : publicBaseUrl;

  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function withCursor(
  path: string,
  cursor?: string,
  additionalParameters: Record<string, string | undefined> = {},
): string {
  const url = new URL(path, "https://displace.invalid");
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }
  for (const [name, value] of Object.entries(additionalParameters)) {
    if (value !== undefined) {
      url.searchParams.set(name, value);
    }
  }
  return `${url.pathname}${url.search}`;
}
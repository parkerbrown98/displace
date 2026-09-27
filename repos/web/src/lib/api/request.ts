import {
  requestJson,
  type JsonRequestOptions,
} from "@displace/api-client/http";

export { withCursor } from "@displace/api-client/http";

export type ApiAudience = "browser" | "public-server";

export interface ApiRequestOptions extends JsonRequestOptions {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
}

export async function apiRequest<T>(
  audience: ApiAudience,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  return requestJson<T>(resolveApiUrl(audience, "/"), path, {
    ...options,
    credentials: audience === "browser" ? "include" : "omit",
  });
}

export function resolveApiUrl(audience: ApiAudience, path: string): string {
  const publicBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
  const baseUrl =
    audience === "public-server"
      ? process.env.API_INTERNAL_URL ?? publicBaseUrl
      : publicBaseUrl;

  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
import { apiRequest, type ApiRequestOptions } from "./request";

export function publicServerRead<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  return apiRequest<T>("public-server", path, {
    ...options,
    method: "GET",
  });
}
import { apiRequest, type ApiRequestOptions } from "./request";

export function browserRead<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>("browser", path, { ...options, method: "GET" });
}

export function browserMutation<T>(
  path: string,
  options: ApiRequestOptions & { method: "DELETE" | "PATCH" | "POST" | "PUT" },
): Promise<T> {
  return apiRequest<T>("browser", path, options);
}
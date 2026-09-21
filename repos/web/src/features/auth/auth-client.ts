import { browserMutation, browserRead } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/problem-details";
import { resolveApiUrl, type ApiRequestOptions } from "@/lib/api/request";
import type {
  AccountSession,
  Authentication,
  MessageResponse,
  RegisterInput,
  SignInInput,
  UserProfile,
} from "./auth-contracts";

let authentication: Authentication | null = null;

function csrfCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const cookie = document.cookie.split("; ").find((item) => item.startsWith("displace_csrf="));
  return cookie ? decodeURIComponent(cookie.slice("displace_csrf=".length)) : undefined;
}

function remember(nextAuthentication: Authentication): Authentication {
  authentication = nextAuthentication;
  return nextAuthentication;
}

export function currentAuthentication(): Authentication | null {
  return authentication;
}

export async function registerAccount(input: RegisterInput): Promise<MessageResponse> {
  return browserMutation<MessageResponse>("/auth/register", { body: input, method: "POST" });
}

export async function verifyEmail(token: string): Promise<void> {
  return browserMutation<void>("/auth/email/verify", { body: { token }, method: "POST" });
}

export async function signIn(input: SignInInput): Promise<Authentication> {
  const result = await browserMutation<Authentication>("/auth/login", {
    body: { ...input, refreshTokenDelivery: "cookie" },
    method: "POST",
  });
  return remember(result);
}

export async function refreshAuthentication(): Promise<Authentication | null> {
  try {
    const result = await browserMutation<Authentication>("/auth/refresh", {
      body: { refreshTokenDelivery: "cookie" },
      csrfToken: csrfCookie(),
      method: "POST",
    });
    return remember(result);
  } catch (error) {
    if (error instanceof ApiError && (error.problem.status === 401 || error.problem.status === 403)) {
      authentication = null;
      return null;
    }
    throw error;
  }
}

export async function forgotPassword(email: string): Promise<MessageResponse> {
  return browserMutation<MessageResponse>("/auth/password/forgot", { body: { email }, method: "POST" });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  return browserMutation<void>("/auth/password/reset", { body: { password, token }, method: "POST" });
}

export function oidcAuthorizeUrl(mode: "link" | "login" = "login"): string {
  return `${resolveApiUrl("browser", "/auth/oidc/authorize")}?mode=${mode}`;
}

export async function getCurrentProfile(): Promise<UserProfile> {
  return authenticatedRead<UserProfile>("/auth/me");
}

export async function updateProfile(input: Pick<UserProfile, "displayName" | "handle">): Promise<UserProfile> {
  return authenticatedMutation<UserProfile>("/auth/me", { body: input, method: "PATCH" });
}

export async function changeEmail(email: string): Promise<MessageResponse> {
  return authenticatedMutation<MessageResponse>("/auth/email/change", { body: { email }, method: "POST" });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return authenticatedMutation<void>("/auth/password/change", {
    body: { currentPassword, newPassword },
    method: "POST",
  });
}

export async function listSessions(): Promise<AccountSession[]> {
  return authenticatedRead<AccountSession[]>("/auth/sessions");
}

export async function revokeSession(sessionId: string): Promise<void> {
  return authenticatedMutation<void>(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}

export async function signOut(all = false): Promise<void> {
  try {
    if (authentication) {
      await authenticatedMutation<void>(all ? "/auth/logout-all" : "/auth/logout", { method: "POST" }, false);
    }
  } finally {
    authentication = null;
  }
}

export async function authenticatedRead<T>(path: string): Promise<T> {
  const token = await accessToken();
  try {
    return await browserRead<T>(path, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
    const refreshed = await refreshAuthentication();
    if (!refreshed) throw error;
    return browserRead<T>(path, { headers: { Authorization: `Bearer ${refreshed.accessToken}` } });
  }
}

export async function authenticatedMutation<T>(
  path: string,
  options: ApiRequestOptions & { method: "DELETE" | "PATCH" | "POST" | "PUT" },
  retry = true,
): Promise<T> {
  const token = await accessToken();
  try {
    return await browserMutation<T>(path, {
      ...options,
      csrfToken: authentication?.csrfToken ?? csrfCookie(),
      headers: { ...Object.fromEntries(new Headers(options.headers)), Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    if (!retry || !isUnauthorized(error)) throw error;
    const refreshed = await refreshAuthentication();
    if (!refreshed) throw error;
    return authenticatedMutation<T>(path, options, false);
  }
}

async function accessToken(): Promise<string> {
  const active = authentication ?? await refreshAuthentication();
  if (!active) {
    throw new ApiError({ status: 401, title: "Authentication required" });
  }
  return active.accessToken;
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.problem.status === 401;
}

export function resetAuthenticationForTests(): void {
  authentication = null;
}
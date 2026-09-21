import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { mockServer } from "@/test/mocks/server";
import {
  changePassword,
  currentAuthentication,
  getCurrentProfile,
  refreshAuthentication,
  resetAuthenticationForTests,
  signIn,
  signOut,
} from "./auth-client";
import { userProfileFixture } from "./auth-fixtures";

describe("authentication client", () => {
  afterEach(() => {
    resetAuthenticationForTests();
  });

  it("keeps access credentials in memory after cookie-delivery login", async () => {
    mockServer.use(http.post("http://localhost:3001/api/v1/auth/login", async ({ request }) => {
      expect(request.credentials).toBe("include");
      expect(await request.json()).toEqual({
        identifier: "parker",
        password: "correct horse battery staple",
        refreshTokenDelivery: "cookie",
      });
      return HttpResponse.json({
        accessToken: "access-token",
        csrfToken: "csrf-token",
        expiresInSeconds: 900,
        user: userProfileFixture,
      });
    }));

    await signIn({ identifier: "parker", password: "correct horse battery staple" });
    expect(currentAuthentication()?.accessToken).toBe("access-token");
    expect(localStorage).toHaveLength(0);
  });

  it("bootstraps from the refresh cookie and authenticates profile reads", async () => {
    document.cookie = "displace_csrf=cookie-csrf; path=/";
    mockServer.use(
      http.post("http://localhost:3001/api/v1/auth/refresh", ({ request }) => {
        expect(request.headers.get("X-CSRF-Token")).toBe("cookie-csrf");
        return HttpResponse.json({ accessToken: "fresh-token", expiresInSeconds: 900, user: userProfileFixture });
      }),
      http.get("http://localhost:3001/api/v1/auth/me", ({ request }) => {
        expect(request.headers.get("Authorization")).toBe("Bearer fresh-token");
        return HttpResponse.json(userProfileFixture);
      }),
    );

    await expect(refreshAuthentication()).resolves.toMatchObject({ accessToken: "fresh-token" });
    await expect(getCurrentProfile()).resolves.toEqual(userProfileFixture);
  });

  it("deduplicates concurrent refresh-token rotations", async () => {
    let refreshCalls = 0;
    mockServer.use(http.post("http://localhost:3001/api/v1/auth/refresh", async () => {
      refreshCalls += 1;
      await Promise.resolve();
      return HttpResponse.json({ accessToken: "shared-token", expiresInSeconds: 900, user: userProfileFixture });
    }));

    const [first, second] = await Promise.all([refreshAuthentication(), refreshAuthentication()]);

    expect(first?.accessToken).toBe("shared-token");
    expect(second?.accessToken).toBe("shared-token");
    expect(refreshCalls).toBe(1);
  });

  it("clears an expired session when refresh is authoritatively rejected", async () => {
    document.cookie = "displace_csrf=expired-csrf; path=/";
    mockServer.use(
      http.post("http://localhost:3001/api/v1/auth/login", () => HttpResponse.json({
        accessToken: "expired-token", csrfToken: "expired-csrf", expiresInSeconds: 1, user: userProfileFixture,
      })),
      http.get("http://localhost:3001/api/v1/auth/me", () => new HttpResponse(null, { status: 401 })),
      http.post("http://localhost:3001/api/v1/auth/refresh", () => new HttpResponse(null, { status: 401 })),
    );

    await signIn({ identifier: "parker", password: "password" });
    await expect(getCurrentProfile()).rejects.toMatchObject({ problem: { status: 401 } });
    expect(currentAuthentication()).toBeNull();
  });

  it("sends CSRF credentials and preserves forbidden mutation responses", async () => {
    mockServer.use(
      http.post("http://localhost:3001/api/v1/auth/login", () => HttpResponse.json({
        accessToken: "access-token", csrfToken: "csrf-token", expiresInSeconds: 900, user: userProfileFixture,
      })),
      http.post("http://localhost:3001/api/v1/auth/password/change", ({ request }) => {
        expect(request.headers.get("Authorization")).toBe("Bearer access-token");
        expect(request.headers.get("X-CSRF-Token")).toBe("csrf-token");
        return HttpResponse.json({ status: 403, title: "A valid CSRF token is required." }, { status: 403 });
      }),
    );

    await signIn({ identifier: "parker", password: "password" });
    await expect(changePassword("old-password", "new-secure-password")).rejects.toMatchObject({
      problem: { status: 403 },
    });
  });

  it("uses the logout-all endpoint and forgets in-memory credentials", async () => {
    mockServer.use(
      http.post("http://localhost:3001/api/v1/auth/login", () => HttpResponse.json({
        accessToken: "access-token", csrfToken: "csrf-token", expiresInSeconds: 900, user: userProfileFixture,
      })),
      http.post("http://localhost:3001/api/v1/auth/logout-all", ({ request }) => {
        expect(request.headers.get("Authorization")).toBe("Bearer access-token");
        expect(request.headers.get("X-CSRF-Token")).toBe("csrf-token");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await signIn({ identifier: "parker", password: "password" });
    await signOut(true);
    expect(currentAuthentication()).toBeNull();
  });
});
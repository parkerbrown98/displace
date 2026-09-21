import type { AccountSession, Authentication, UserProfile } from "./auth-contracts";

export const userProfileFixture: UserProfile = {
  id: "01990000-7000-8000-8000-000000000501",
  handle: "parker",
  displayName: "Parker",
  email: "parker@example.com",
  emailVerified: true,
};

export const accountSessionsFixture: AccountSession[] = [
  {
    id: "01990000-7000-8000-8000-000000000601",
    createdAt: "2026-09-18T14:00:00.000Z",
    expiresAt: "2026-10-18T14:00:00.000Z",
    lastSeenAt: "2026-09-20T18:42:00.000Z",
    ipAddress: "192.0.2.1",
    userAgent: "Chrome on Windows",
    current: true,
  },
  {
    id: "01990000-7000-8000-8000-000000000602",
    createdAt: "2026-09-10T09:20:00.000Z",
    expiresAt: "2026-10-10T09:20:00.000Z",
    lastSeenAt: "2026-09-19T21:16:00.000Z",
    ipAddress: "198.51.100.8",
    userAgent: "Safari on iPhone",
    current: false,
  },
];

export function createAuthenticationFixture(): Authentication {
  return {
    accessToken: "fixture-access-token",
    csrfToken: "fixture-csrf-token",
    expiresInSeconds: 900,
    user: structuredClone(userProfileFixture),
  };
}
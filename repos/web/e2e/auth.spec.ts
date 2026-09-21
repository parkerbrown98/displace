import { expect, test, type Page } from "@playwright/test";
import { e2ePassword, login, registerVerifiedUser, requestPasswordReset, uniqueValue } from "./support/api";

async function openHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test("registers and requests account recovery without revealing account existence", async ({ page }, testInfo) => {
  const handle = uniqueValue("register", testInfo).slice(0, 32);
  await openHydrated(page, "/register");
  await page.getByLabel("Display name").fill("Browser Registration");
  await page.getByLabel("Handle").fill(handle);
  await page.getByLabel("Email").fill(`${handle}@example.test`);
  await page.getByLabel("Password").fill(e2ePassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/If registration can proceed/)).toBeVisible();

  await openHydrated(page, "/forgot-password");
  await page.getByLabel("Email").fill("unknown@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If the account exists/)).toBeVisible();
});

test("resets a password and recovers from a failed OIDC callback", async ({ page, request }, testInfo) => {
  const user = await registerVerifiedUser(request, testInfo, "reset");
  const token = await requestPasswordReset(request, user);
  await openHydrated(page, `/reset-password?token=${encodeURIComponent(token)}`);
  await page.getByLabel("New password").fill("new correct horse battery staple");
  await page.getByLabel("Confirm password").fill("new correct horse battery staple");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Password updated")).toBeVisible();

  await openHydrated(page, "/auth/callback");
  await expect(page.getByText(/Sign-in could not be completed/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to sign in" })).toBeVisible();
});

test("returns from an expired session and manages signed-in devices", async ({ page, request }, testInfo) => {
  const user = await registerVerifiedUser(request, testInfo, "sessions");
  await login(request, user, "Safari on iPhone");
  await openHydrated(page, "/session-expired");
  await page.getByRole("link", { name: "Sign in again" }).click();
  await page.getByLabel("Email or handle").fill(user.handle);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Active sessions" })).toBeVisible();
  await page.getByRole("button", { name: "Revoke Safari on iPhone" }).click();
  await expect(page.locator(".session-row").filter({ hasText: "Safari on iPhone" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(page).toHaveURL(/\/(?:discover)?$/);
  await openHydrated(page, "/settings");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Sign in required" })).toBeVisible();
});
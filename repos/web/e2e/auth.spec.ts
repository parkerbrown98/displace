import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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

  await expect(page).toHaveURL(/\/settings\/sessions$/);
  await expect(page.getByRole("heading", { name: "Active sessions" })).toBeVisible();
  const settingsNavigation = page.getByRole("navigation", { name: "Account settings sections" });
  await settingsNavigation.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active sessions" })).not.toBeVisible();
  await settingsNavigation.getByRole("link", { name: "Sessions" }).click();
  await expect(page).toHaveURL(/\/settings\/sessions$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Active sessions" })).toBeVisible();
  await page.getByRole("button", { name: "Revoke Safari on iPhone" }).click();
  await expect(page.locator(".session-row").filter({ hasText: "Safari on iPhone" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(page).toHaveURL(/\/(?:discover)?$/);
  await openHydrated(page, "/settings");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Sign in required" })).toBeVisible();
});

test("creates, rotates, and revokes a personal API token", async ({ page, request }, testInfo) => {
  const user = await registerVerifiedUser(request, testInfo, "api_token");
  await openHydrated(page, "/sign-in?returnTo=%2Fsettings%2Ftokens");
  await page.getByLabel("Email or handle").fill(user.handle);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/settings\/tokens$/);
  await expect(page.locator("#tokens")).toHaveScreenshot("api-token-settings.png", { animations: "disabled" });
  const accessibility = await new AxeBuilder({ page }).include("#tokens").analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole("button", { name: "Create token" }).click();
  const createDialog = page.getByRole("dialog", { name: "Create API token" });
  await createDialog.getByLabel("Token name").fill("Browser automation");
  await createDialog.getByLabel("Write").check();
  await createDialog.getByRole("button", { name: "Create token" }).click();

  const revealDialog = page.getByRole("dialog", { name: "Save your API token" });
  const originalToken = await revealDialog.locator(".token-secret code").textContent();
  expect(originalToken).toMatch(/^dsp_/);
  await revealDialog.getByRole("button", { name: "Close" }).click();
  const tokenRow = page.locator(".token-row").filter({ hasText: "Browser automation" }).last();
  await expect(tokenRow).toContainText("read / write");

  const apiUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001/api/v1";
  const profile = await request.get(`${apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${originalToken}` },
  });
  expect(profile.status(), await profile.text()).toBe(200);

  await tokenRow.getByRole("button", { name: "Rotate Browser automation" }).click();
  await page.getByRole("dialog", { name: "Rotate API token" }).getByRole("button", { name: "Rotate token" }).click();
  const rotatedDialog = page.getByRole("dialog", { name: "Save your API token" });
  const rotatedToken = await rotatedDialog.locator(".token-secret code").textContent();
  expect(rotatedToken).toMatch(/^dsp_/);
  expect(rotatedToken).not.toBe(originalToken);
  await rotatedDialog.getByRole("button", { name: "Close" }).click();

  const oldTokenResponse = await request.get(`${apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${originalToken}` },
  });
  expect(oldTokenResponse.status()).toBe(401);

  const activeRow = page.locator(".token-row").filter({ hasText: "Browser automation" }).filter({ hasText: "Active" });
  await activeRow.getByRole("button", { name: "Revoke Browser automation" }).click();
  await page.getByRole("dialog", { name: "Revoke API token" }).getByRole("button", { name: "Revoke token" }).click();
  await expect(page.locator(".token-row").filter({ hasText: "Active" })).toHaveCount(0);

  const revokedTokenResponse = await request.get(`${apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${rotatedToken}` },
  });
  expect(revokedTokenResponse.status()).toBe(401);
});
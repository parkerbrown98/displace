import { expect, test, type Page } from "@playwright/test";

async function openHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test("registers and requests account recovery without revealing account existence", async ({ page }) => {
  await openHydrated(page, "/register");
  await page.getByLabel("Display name").fill("Parker");
  await page.getByLabel("Handle").fill("parker");
  await page.getByLabel("Email").fill("parker@example.com");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/If registration can proceed/)).toBeVisible();

  await openHydrated(page, "/forgot-password");
  await page.getByLabel("Email").fill("unknown@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If the account exists/)).toBeVisible();
});

test("resets a password and recovers from a failed OIDC callback", async ({ page }) => {
  await openHydrated(page, "/reset-password?token=fixture-reset-token");
  await page.getByLabel("New password").fill("new correct horse battery staple");
  await page.getByLabel("Confirm password").fill("new correct horse battery staple");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Password updated")).toBeVisible();

  await openHydrated(page, "/auth/callback");
  await expect(page.getByText(/Sign-in could not be completed/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to sign in" })).toBeVisible();
});

test("returns from an expired session and manages signed-in devices", async ({ page }) => {
  await openHydrated(page, "/session-expired");
  await page.getByRole("link", { name: "Sign in again" }).click();
  await page.getByLabel("Email or handle").fill("parker");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Active sessions" })).toBeVisible();
  await page.getByRole("button", { name: "Revoke Safari on iPhone" }).click();
  await expect(page.getByText("Safari on iPhone")).not.toBeVisible();

  await page.getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.locator('a[href="/settings"]').first().evaluate((element: HTMLElement) => element.click());
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Sign in required" })).toBeVisible();
});
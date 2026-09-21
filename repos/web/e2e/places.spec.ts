import { expect, test, type Page } from "@playwright/test";

async function openHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function signIn(page: Page) {
  await openHydrated(page, "/sign-in");
  await page.getByLabel("Email or handle").fill("parker");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("creates and manages a place with capability-driven controls", async ({ page }) => {
  await signIn(page);
  await page.locator('a[href="/places/game-makers"]').first().click();
  await expect(page).toHaveURL(/\/places\/game-makers$/);
  await expect(page.getByRole("link", { name: "Manage" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave" })).toBeDisabled();

  await page.getByRole("link", { name: "Manage" }).click();
  await expect(page).toHaveURL(/\/places\/game-makers\/settings$/);
  await expect(page.getByRole("heading", { name: "Roles and permissions" })).toBeVisible();
  const ownerRole = page.locator("details").filter({ hasText: "Owner" });
  await ownerRole.locator("summary").click();
  await expect(ownerRole.getByText("System role permissions cannot be changed.")).toBeVisible();

  await page.locator('a[href="/places/new"]').evaluate((element: HTMLElement) => element.click());
  await expect(page).toHaveURL(/\/places\/new$/);
  await page.getByLabel("Name", { exact: true }).fill("Tabletop Studio");
  await page.getByLabel("Slug").fill("tabletop-studio");
  await page.getByLabel("Description").fill("A community for tabletop makers.");
  await page.getByRole("combobox", { name: /Join policy/ }).selectOption("approval");
  await page.getByRole("button", { name: "Create place" }).click();
  await expect(page).toHaveURL(/\/places\/tabletop-studio\/settings$/);
});

test("reviews memberships and accepts a place invitation", async ({ page }) => {
  await signIn(page);
  await page.locator('a[href="/places/game-makers"]').first().click();
  await page.getByRole("link", { name: "Members" }).click();
  await expect(page.getByRole("heading", { name: "Membership requests" })).toBeVisible();
  await expect(page.getByText("The owner cannot be removed. Transfer ownership first.")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("heading", { name: "Membership requests" })).not.toBeVisible();
  await expect(page.getByText("Noah Park", { exact: true }).last()).toBeVisible();

});

test("returns through sign-in to accept a place invitation", async ({ page }) => {
  await openHydrated(page, "/places/game-makers/invites/accept?token=fixture-invite-token-0123456789abcdef");
  await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
  await page.getByLabel("Email or handle").fill("parker");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/places\/game-makers\/invites\/accept/);
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page).toHaveURL(/\/places\/game-makers$/);
});
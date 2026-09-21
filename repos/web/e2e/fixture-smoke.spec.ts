import { expect, test } from "@playwright/test";

test("renders and navigates the fixture-backed community", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Game Makers" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();

  await page.getByRole("link", { name: "Discover" }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
});
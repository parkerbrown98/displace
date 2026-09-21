import { expect, test } from "@playwright/test";

test("renders and navigates the API-backed community", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole("heading", { name: "Find your next conversation" })).toBeVisible();
});

test("public discovery, forum, topic, and profile are crawlable", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/discover$/);
  await page.getByRole("link", { name: "Game Makers" }).click();
  await expect(page.getByRole("heading", { name: "Browse discussions" })).toBeVisible();

  await page.getByRole("link", { name: "Showcase" }).click();
  await expect(page.getByRole("heading", { name: "Showcase" })).toBeVisible();
  await page.getByRole("link", { name: "What are you building this week?" }).click();
  await expect(page).toHaveTitle(/What are you building this week/);
  await expect(page.getByText("deterministic previews")).toBeVisible();
  await expect(page.getByText("This post was removed.")).toBeVisible();

  await page.goto("/members/mara_v");
  await expect(page.getByRole("heading", { name: "Mara V." })).toBeVisible();
  await expect(page.locator("main")).toContainText("@mara_v");
});
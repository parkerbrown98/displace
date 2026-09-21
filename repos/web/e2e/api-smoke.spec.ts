import { expect, test } from "@playwright/test";
import { createCommunity, createDeletedReply, registerVerifiedUser } from "./support/api";

test("renders and navigates the API-backed community", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole("heading", { name: "Find your next conversation" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("public discovery, forum, topic, and profile are crawlable", async ({ page, request }, testInfo) => {
  const owner = await registerVerifiedUser(request, testInfo, "public_owner");
  const community = await createCommunity(request, owner, testInfo);
  await createDeletedReply(request, owner, community);
  await page.goto(`/discover?q=${encodeURIComponent(community.placeName)}`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/discover$/);
  await page.getByRole("link", { name: community.placeName }).click();
  await expect(page.getByRole("heading", { name: "Browse discussions" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();

  await page.getByRole("link", { name: "Showcase" }).click();
  await expect(page.getByRole("heading", { name: "Showcase" })).toBeVisible();
  await page.getByRole("link", { name: community.topicTitle }).click();
  await expect(page).toHaveTitle(new RegExp(community.topicTitle));
  await expect(page.getByText("A real API-backed browser test discussion.")).toBeVisible();
  await expect(page.getByText("This post was removed.")).toBeVisible();

  await page.goto(`/members/${owner.handle}`);
  await expect(page.getByRole("heading", { name: owner.displayName })).toBeVisible();
  await expect(page.locator(".profile-handle:visible")).toHaveText(`@${owner.handle}`);
});
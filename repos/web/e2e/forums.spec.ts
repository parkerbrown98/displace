import { expect, test, type Page } from "@playwright/test";
import { createCommunity, registerVerifiedUser, type E2eUser } from "./support/api";

async function openHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function signIn(page: Page, user: E2eUser) {
  await openHydrated(page, "/sign-in");
  await page.getByLabel("Email or handle").fill(user.handle);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/discover$/);
}

test("authors and manages a discussion through the API", async ({ page, request }, testInfo) => {
  test.setTimeout(60_000);
  const owner = await registerVerifiedUser(request, testInfo, "forum_owner");
  const community = await createCommunity(request, owner, testInfo, { withTopic: false });
  const title = `Browser topic ${Date.now().toString(36)}`;
  await signIn(page, owner);

  await openHydrated(page, `/places/${community.placeSlug}/topics/new`);
  await expect(page.getByRole("combobox", { name: "Forum" })).toContainText(/.+/);
  await page.getByLabel("Title").fill(title);
  await page.getByRole("textbox", { name: "Opening post" }).fill("Opening thought for the browser journey. ");
  await page.getByRole("button", { name: "Mention member" }).click();
  await page.getByLabel("Find a member to mention").fill(owner.handle.slice(0, 8));
  await page.getByRole("button", { name: new RegExp(`@${owner.handle}`) }).click();
  await page.getByRole("button", { name: "Publish topic" }).click();

  await expect(page).toHaveURL(new RegExp(`/places/${community.placeSlug}/topics/[0-9a-f-]+$`));
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("textbox", { name: "Reply" }).fill("A reply created in the browser.");
  await page.getByRole("button", { name: "Publish reply" }).click();
  const reply = page.locator("article.post").last();
  await expect(reply.getByText("A reply created in the browser.")).toBeVisible();

  await reply.getByRole("button", { name: "like" }).click();
  await expect(reply.getByRole("button", { name: "like 1" })).toHaveAttribute("aria-pressed", "true");
  await reply.getByRole("button", { name: "Edit" }).click();
  await reply.getByRole("textbox", { name: "Edit post" }).fill("An edited reply from the browser.");
  await reply.getByRole("button", { name: "Save edit" }).click();
  await expect(reply.getByText("An edited reply from the browser.")).toBeVisible();
  await reply.getByRole("button", { name: "History" }).click();
  await expect(reply.getByText("Revision history")).toBeVisible();
  await reply.getByRole("button", { name: "Save", exact: true }).click();

  const topicActions = page.getByRole("region", { name: "Topic actions" });
  await topicActions.getByRole("button", { name: "Follow" }).click();
  await expect(topicActions.getByRole("button", { name: "Following" })).toHaveAttribute("aria-pressed", "true");
  await topicActions.getByRole("button", { name: "Save" }).click();
  await topicActions.getByTitle("Lock topic").click();
  await expect(topicActions.getByTitle("Unlock topic")).toHaveAttribute("aria-pressed", "true");
  await topicActions.getByTitle("Pin topic").click();
  await expect(topicActions.getByTitle("Unpin topic")).toHaveAttribute("aria-pressed", "true");

  await openHydrated(page, "/saved");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "An edited reply from the browser." })).toBeVisible();
});

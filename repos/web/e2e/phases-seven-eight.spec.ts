import { expect, test, type Page } from "@playwright/test";
import { createCommunity, joinCommunity, registerVerifiedUser, type E2eUser } from "./support/api";

const apiUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001/api/v1";

async function signIn(page: Page, user: E2eUser) {
  await page.goto("/sign-in");
  await page.getByLabel("Email or handle").fill(user.handle);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/discover$/);
}

test("opens Discover with the current place selected", async ({ page, request }, testInfo) => {
  const owner = await registerVerifiedUser(request, testInfo, "search_owner");
  const community = await createCommunity(request, owner, testInfo);

  await page.goto(`/places/${community.placeSlug}`);
  await page.getByRole("link", { name: `Search in ${community.placeName}` }).click();

  await expect(page).toHaveURL(`/discover?placeId=${community.placeId}`);
  await expect(page.getByRole("combobox", { name: "Search scope" })).toHaveValue(community.placeId);
  await expect(page.locator(".discovery-command").getByRole("searchbox", { name: "Search" })).toBeFocused();
});

test("indexes public content and delivers chat mentions over the live stack", async ({ browser, page, request }, testInfo) => {
  test.setTimeout(90_000);
  const owner = await registerVerifiedUser(request, testInfo, "phase_owner");
  const recipient = await registerVerifiedUser(request, testInfo, "phase_recipient");
  const community = await createCommunity(request, owner, testInfo);
  await joinCommunity(request, recipient, community.placeId);

  await expect.poll(async () => {
    const response = await request.get(`${apiUrl}/search?q=${encodeURIComponent(community.placeName)}`);
    if (!response.ok()) return false;
    const result = await response.json() as { items: Array<{ placeId: string }> };
    return result.items.some((item) => item.placeId === community.placeId);
  }, { timeout: 30_000 }).toBe(true);

  await page.goto(`/search?q=${encodeURIComponent(community.placeName)}`);
  await expect.poll(() => {
    const destination = new URL(page.url());
    return { pathname: destination.pathname, query: destination.searchParams.get("q") };
  }).toEqual({ pathname: "/discover", query: community.placeName });
  await expect(page.getByRole("heading", { name: community.placeName })).toBeVisible();

  await signIn(page, owner);
  await page.goto(`/places/${community.placeSlug}`);
  const navigation = page.getByRole("navigation", { name: `${community.placeName} navigation` });
  await expect(navigation.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Chat" })).toHaveCount(0);
  await navigation.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Chat channels" })).toBeVisible();
  await page.getByLabel("Channel name").fill("Live room");
  await page.getByLabel("Channel slug").fill("live-room");
  await page.getByRole("button", { name: "Create channel" }).click();
  await expect(page.getByText("Channel created.")).toBeVisible();

  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  try {
    await signIn(recipientPage, recipient);
    await recipientPage.goto(`/places/${community.placeSlug}/chat/live-room`);
    await expect(recipientPage.locator(".chat-heading h1")).toContainText("Live room");
    await expect(recipientPage.locator(".chat-live-status")).toHaveText("Live");

    await page.goto(`/places/${community.placeSlug}`);
    await page.getByRole("navigation", { name: `${community.placeName} navigation` }).getByRole("link", { name: "Chat" }).click();
    await expect(page.locator(".chat-heading h1")).toContainText("Live room");
    await expect(page.locator(".chat-live-status")).toHaveText("Live");
    const message = `Realtime mention for @${recipient.handle}`;
    await page.getByLabel("Message Live room").fill(message);
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(recipientPage.getByText(message)).toBeVisible({ timeout: 15_000 });
    await expect(recipientPage.locator(".notification-dot")).toBeVisible({ timeout: 15_000 });
    await recipientPage.goto("/notifications");
    await expect(recipientPage.getByText("You were mentioned in chat")).toBeVisible();
  } finally {
    await recipientContext.close();
  }
});
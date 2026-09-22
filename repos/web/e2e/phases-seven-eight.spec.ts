import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createCommunity, joinCommunity, login, registerVerifiedUser, type E2eAuthentication, type E2eUser } from "./support/api";

const apiUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001/api/v1";

async function authenticatedRequest(
  request: APIRequestContext,
  authentication: E2eAuthentication,
  method: "POST" | "PUT",
  path: string,
  data: unknown,
) {
  return request.fetch(`${apiUrl}${path}`, {
    data,
    headers: { Authorization: `Bearer ${authentication.accessToken}`, Origin: "http://localhost:3000" },
    method,
  });
}

async function signIn(page: Page, user: E2eUser) {
  await page.goto("/sign-in");
  await page.getByLabel("Email or handle").fill(user.handle);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/discover$/);
}

test("indexes public content and delivers chat mentions over the live stack", async ({ browser, page, request }, testInfo) => {
  test.setTimeout(90_000);
  const owner = await registerVerifiedUser(request, testInfo, "phase_owner");
  const recipient = await registerVerifiedUser(request, testInfo, "phase_recipient");
  const community = await createCommunity(request, owner, testInfo);
  await joinCommunity(request, recipient, community.placeId);
  const ownerAuthentication = await login(request, owner);

  await expect.poll(async () => {
    const response = await request.get(`${apiUrl}/search?q=${encodeURIComponent(community.placeName)}`);
    if (!response.ok()) return false;
    const result = await response.json() as { items: Array<{ placeId: string }> };
    return result.items.some((item) => item.placeId === community.placeId);
  }, { timeout: 30_000 }).toBe(true);

  await page.goto(`/search?q=${encodeURIComponent(community.placeName)}`);
  await expect(page.getByRole("heading", { name: community.placeName })).toBeVisible();

  const channelResponse = await authenticatedRequest(request, ownerAuthentication, "POST", `/places/${community.placeId}/chat/channels`, {
    name: "Live room",
    slug: "live-room",
    visibility: "members",
  });
  expect(channelResponse.status(), await channelResponse.text()).toBe(201);

  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  try {
    await signIn(recipientPage, recipient);
    await recipientPage.goto(`/places/${community.placeSlug}/chat/live-room`);
    await expect(recipientPage.locator(".chat-heading h1")).toContainText("Live room");
    await expect(recipientPage.locator(".chat-live-status")).toHaveText("Live");

    await signIn(page, owner);
  await page.goto(`/places/${community.placeSlug}`);
  await expect(page.getByPlaceholder("Search discussions")).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: `${community.placeName} navigation` }).getByRole("link", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Search discussions" }).click();
  await expect(page.getByPlaceholder("Search discussions")).toBeVisible();
  await page.getByTitle("Close search").click();
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
import { expect, test, type Page } from "@playwright/test";
import {
  createCommunity,
  joinCommunity,
  login,
  registerVerifiedUser,
  type E2eUser,
} from "./support/api";

const apiUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001/api/v1";

async function signIn(page: Page, user: E2eUser) {
  await page.goto("/sign-in");
  await page.getByLabel("Email or handle").fill(user.handle);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/discover$/);
}

test("reports a member and resolves the case through the moderator queue", async ({ page, request }, testInfo) => {
  const owner = await registerVerifiedUser(request, testInfo, "mod_owner");
  const subject = await registerVerifiedUser(request, testInfo, "mod_subject");
  const community = await createCommunity(request, owner, testInfo, { withTopic: false });
  await joinCommunity(request, subject, community.placeId);

  const ownerAuthentication = await login(request, owner);
  const subjectAuthentication = await login(request, subject);
  const membersResponse = await request.get(`${apiUrl}/places/${community.placeId}/members?status=active`, {
    headers: { Authorization: `Bearer ${ownerAuthentication.accessToken}` },
  });
  expect(membersResponse.status(), await membersResponse.text()).toBe(200);
  const member = (await membersResponse.json() as { items: Array<{ id: string; userId: string }> }).items.find((item) => item.userId === subjectAuthentication.user.id);
  expect(member).toBeDefined();

  await signIn(page, owner);
  await page.goto(`/places/${community.placeSlug}/members/${member!.id}`);
  await page.getByRole("button", { name: `Report ${subject.displayName}`, exact: true }).click();
  await page.getByRole("combobox", { name: "Reason" }).click();
  await page.getByRole("option", { name: "harassment" }).click();
  await page.getByLabel("Details").fill("Repeated unwanted contact after a clear request to stop.");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("status")).toHaveText("Report submitted.");

  await page.goto(`/places/${community.placeSlug}/moderation`);
  await expect(page.getByRole("heading", { name: "Review reports" })).toBeVisible();
  const queueItem = page.locator(".case-open").filter({ hasText: subject.displayName });
  await expect(queueItem).toBeVisible();
  await queueItem.click();
  await expect(page.getByRole("heading", { name: subject.displayName })).toBeVisible();
  await page.getByRole("button", { name: "Assign to me" }).click();
  await expect(page.getByRole("button", { name: "Assigned to you" })).toBeDisabled();

  await page.getByRole("combobox", { name: "Action" }).click();
  await page.getByRole("option", { name: "Member warn" }).click();
  await page.getByRole("combobox", { name: "Reason code" }).click();
  await page.getByRole("option", { name: "Harassment" }).click();
  await page.getByLabel("Reason", { exact: true }).fill("Stop contacting members who have asked you to stop.");
  await page.getByRole("button", { name: "Apply action" }).click();
  await expect(page.locator(".case-history").getByText("Member warn", { exact: true })).toBeVisible();

  await page.locator("summary").filter({ hasText: "Private notes" }).click();
  await page.getByLabel("Note").fill("Evidence reviewed and warning delivered.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Evidence reviewed and warning delivered.")).toBeVisible();

  await page.locator("summary").filter({ hasText: "Close case" }).click();
  await page.getByLabel("Resolution summary", { exact: true }).fill("Warning issued and reporter notified.");
  await page.getByRole("button", { name: "Close case" }).click();
  await expect(page.locator(".case-status")).toHaveText("Resolved");
  await expect(page.getByText("Warning issued and reporter notified.")).toBeVisible();
});
import { expect, test, type Page } from "@playwright/test";
import { createCommunity, createInvite, joinCommunity, registerVerifiedUser, type E2eUser, uniqueValue } from "./support/api";

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

test("creates and manages a place with capability-driven controls", async ({ page, request }, testInfo) => {
  const user = await registerVerifiedUser(request, testInfo, "place_owner");
  const slug = uniqueValue("tabletop", testInfo).replaceAll("_", "-");
  await signIn(page, user);
  await openHydrated(page, "/places/new");
  await expect(page).toHaveURL(/\/places\/new$/);
  await page.getByLabel("Name", { exact: true }).fill("Tabletop Studio");
  await page.getByLabel("Slug").fill(slug);
  await page.getByLabel("Description").fill("A community for tabletop makers.");
  await page.getByRole("combobox", { name: /Join policy/ }).selectOption("approval");
  await page.getByRole("button", { name: "Create place" }).click();
  await expect(page).toHaveURL(new RegExp(`/places/${slug}/settings$`));
  await expect(page.getByRole("heading", { name: "Roles and permissions" })).toBeVisible();

  const groupCreator = page.locator("details.forum-admin-create").filter({ hasText: "Create forum group" });
  await groupCreator.locator("summary").click();
  await groupCreator.getByLabel("Group name").fill("General");
  await groupCreator.getByLabel("Description").fill("Community conversations.");
  await groupCreator.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByText("Forum group created.")).toBeVisible();

  const forumCreator = page.locator("details.forum-admin-create").filter({ hasText: "Create forum" }).last();
  await forumCreator.locator("summary").click();
  await forumCreator.getByLabel("Forum name").fill("General discussion");
  await forumCreator.getByLabel("Description").fill("A place to start talking.");
  await forumCreator.getByRole("button", { name: "Create forum" }).click();
  await expect(page.getByText("Forum created.")).toBeVisible();

  const ownerRole = page.locator("details").filter({ hasText: "Owner" });
  await ownerRole.locator("summary").click();
  await expect(ownerRole.getByText("System role permissions cannot be changed.")).toBeVisible();

  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("link", { name: /General discussion/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage forums" })).toBeVisible();
  await page.getByRole("link", { name: "New topic" }).click();
  await page.getByLabel("Forum").selectOption({ label: "General discussion" });
  await page.getByLabel("Title").fill("Welcome to the studio");
  await page.getByRole("textbox", { name: "Opening post" }).fill("This topic was created through the browser interface.");
  await page.getByRole("button", { name: "Publish topic" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to the studio" })).toBeVisible();
  await page.getByRole("textbox", { name: "Reply" }).fill("This reply was created through the browser interface.");
  await page.getByRole("button", { name: "Publish reply" }).click();
  await expect(page.getByText("This reply was created through the browser interface.")).toBeVisible();
});

test("reviews membership requests", async ({ page, request }, testInfo) => {
  const owner = await registerVerifiedUser(request, testInfo, "review_owner");
  const applicant = await registerVerifiedUser(request, testInfo, "applicant");
  const community = await createCommunity(request, owner, testInfo, { joinPolicy: "approval", withTopic: false });
  await joinCommunity(request, applicant, community.placeId);
  await signIn(page, owner);
  await openHydrated(page, `/places/${community.placeSlug}/members`);
  await expect(page.getByRole("heading", { name: "Membership requests" })).toBeVisible();
  await expect(page.getByText("The owner cannot be removed. Transfer ownership first.")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("heading", { name: "Membership requests" })).not.toBeVisible();
  await expect(page.getByText(applicant.displayName, { exact: true }).last()).toBeVisible();
});

test("returns through sign-in to accept a place invitation", async ({ page, request }, testInfo) => {
  const owner = await registerVerifiedUser(request, testInfo, "invite_owner");
  const invitee = await registerVerifiedUser(request, testInfo, "invitee");
  const community = await createCommunity(request, owner, testInfo, { joinPolicy: "invite_only", withTopic: false });
  const token = await createInvite(request, owner, community.placeId);
  await openHydrated(page, `/places/${community.placeSlug}/invites/accept?token=${encodeURIComponent(token)}`);
  await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
  await page.getByLabel("Email or handle").fill(invitee.handle);
  await page.getByLabel("Password").fill(invitee.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/places/${community.placeSlug}/invites/accept`));
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page).toHaveURL(new RegExp(`/places/${community.placeSlug}$`));
});
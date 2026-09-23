import { expect, test, type Page } from "@playwright/test";
import { createChatChannel, createCommunity, createVoiceRoom, joinCommunity, registerVerifiedUser, restrictVoiceSpeaking, type E2eUser } from "./support/api";

async function signIn(page: Page, user: E2eUser) {
  await page.goto("/sign-in");
  await page.getByRole("textbox", { name: "Email or handle" }).first().fill(user.handle);
  await page.getByRole("textbox", { name: "Password" }).first().fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/discover$/);
}

test("connects to LiveKit and enforces mute, permission, and capacity state", async ({ browser, page, request }, testInfo) => {
  test.setTimeout(90_000);
  const owner = await registerVerifiedUser(request, testInfo, "voice_owner");
  const member = await registerVerifiedUser(request, testInfo, "voice_member");
  const community = await createCommunity(request, owner, testInfo, { withTopic: false });
  await joinCommunity(request, member, community.placeId);
  await createChatChannel(request, owner, community.placeId, "Lobby", 0);
  await createChatChannel(request, owner, community.placeId, "Workshop", 1);
  const room = await createVoiceRoom(request, owner, community.placeId);

  await signIn(page, member);
  await page.goto(`/places/${community.placeSlug}/live`);
  await page.getByRole("button", { name: new RegExp(room.name) }).click();
  await expect(page.getByRole("heading", { name: room.name })).toBeVisible();
  await expect(page.locator(".voice-live-status")).toHaveText("Live", { timeout: 15_000 });
  await page.evaluate(() => {
    const mediaDevices = navigator.mediaDevices;
    const getUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    Object.defineProperty(mediaDevices, "getUserMedia", {
      configurable: true,
      value: (constraints: MediaStreamConstraints) => new Promise<MediaStream>((resolve, reject) => {
        (window as typeof window & { releaseVoiceMicrophone?: () => void }).releaseVoiceMicrophone = () => {
          void getUserMedia(constraints).then(resolve, reject);
        };
      }),
    });
  });
  await page.getByRole("button", { name: "Join room" }).click();
  await expect(page.locator(".voice-connection")).toHaveText("connected", { timeout: 20_000 });
  await expect(page.getByLabel(`${room.name} participants`).getByText(member.displayName)).toBeVisible();
  await page.evaluate(() => (window as typeof window & { releaseVoiceMicrophone?: () => void }).releaseVoiceMicrophone?.());
  await expect(page.getByRole("button", { name: "Mute microphone" })).toBeEnabled();
  await page.getByRole("button", { name: "Mute microphone" }).click();
  await expect(page.getByRole("button", { name: "Unmute microphone" })).toBeVisible();
  await page.getByRole("button", { name: "Workshop" }).click();
  await expect(page).toHaveURL(`/places/${community.placeSlug}/live`);
  await expect(page.getByRole("heading", { name: "Workshop" })).toBeVisible();
  await expect(page.locator(".voice-connection")).toHaveText("connected");

  await restrictVoiceSpeaking(request, owner, community.placeId, room.id);
  await expect(page.getByText(/speaking permission changed/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { includeHidden: true, name: "Unmute microphone" })).toBeDisabled();

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  try {
    await signIn(ownerPage, owner);
    await ownerPage.goto(`/places/${community.placeSlug}/live`);
    await ownerPage.getByRole("button", { name: new RegExp(room.name) }).click();
    await ownerPage.getByRole("button", { name: "Join room" }).click();
    await expect(ownerPage.getByText("Voice room is full.")).toBeVisible({ timeout: 15_000 });
  } finally {
    await ownerContext.close();
  }

  await page.getByRole("button", { name: new RegExp(room.name) }).click();
  await page.locator(".voice-controls").getByRole("button", { name: "Leave" }).click();
  await expect(page.locator(".voice-connection")).toHaveText("disconnected");
  await expect(page.getByLabel(`${room.name} participants`)).toHaveCount(0);
});
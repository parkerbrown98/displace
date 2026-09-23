import { expect, type APIRequestContext, type TestInfo } from "@playwright/test";

const apiUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001/api/v1";
const mailpitUrl = process.env.PLAYWRIGHT_MAILPIT_URL ?? "http://localhost:8025";
export const e2ePassword = "correct horse battery staple";

export interface E2eUser {
  displayName: string;
  email: string;
  handle: string;
  password: string;
}

export interface E2eAuthentication {
  accessToken: string;
  user: { id: string; handle: string };
}

export interface E2eCommunity {
  forumId: string;
  placeId: string;
  placeName: string;
  placeSlug: string;
  topicId: string;
  topicTitle: string;
}

export interface E2eVoiceRoom {
  id: string;
  name: string;
}

export interface E2eChatChannel {
  id: string;
  name: string;
}

export function uniqueValue(prefix: string, testInfo: TestInfo): string {
  const project = testInfo.project.name.startsWith("mobile") ? "m" : "d";
  return `${prefix}_${project}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function registerVerifiedUser(request: APIRequestContext, testInfo: TestInfo, prefix = "e2e"): Promise<E2eUser> {
  const handle = uniqueValue(prefix, testInfo).slice(0, 32);
  const user = { displayName: `E2E ${prefix}`, email: `${handle}@example.test`, handle, password: e2ePassword };
  const response = await request.post(`${apiUrl}/auth/register`, { data: user });
  expect(response.status(), await response.text()).toBe(202);
  const token = await mailToken(request, user.email, "Verify email");
  const verification = await request.post(`${apiUrl}/auth/email/verify`, { data: { token } });
  expect(verification.status(), await verification.text()).toBe(204);
  return user;
}

export async function login(request: APIRequestContext, user: E2eUser, userAgent?: string): Promise<E2eAuthentication> {
  const response = await request.post(`${apiUrl}/auth/login`, {
    data: { identifier: user.handle, password: user.password, refreshTokenDelivery: "response_body" },
    headers: userAgent ? { "User-Agent": userAgent } : undefined,
  });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

export async function requestPasswordReset(request: APIRequestContext, user: E2eUser): Promise<string> {
  const response = await request.post(`${apiUrl}/auth/password/forgot`, { data: { email: user.email } });
  expect(response.status(), await response.text()).toBe(202);
  return mailToken(request, user.email, "Reset password");
}

export async function createCommunity(request: APIRequestContext, user: E2eUser, testInfo: TestInfo, options: { joinPolicy?: "open" | "approval" | "invite_only"; withTopic?: boolean } = {}): Promise<E2eCommunity> {
  const authentication = await login(request, user);
  const placeSlug = uniqueValue("place", testInfo).replaceAll("_", "-").slice(0, 48);
  const placeName = `Studio ${placeSlug.slice(-6).replaceAll("-", "")}`;
  const placeResponse = await authorized(request, authentication.accessToken, "POST", "/places", {
    description: "A browser-tested community.",
    joinPolicy: options.joinPolicy ?? "open",
    name: placeName,
    slug: placeSlug,
    visibility: "public",
  });
  expect(placeResponse.status(), await placeResponse.text()).toBe(201);
  const place = await placeResponse.json() as { id: string };
  const groupResponse = await authorized(request, authentication.accessToken, "POST", `/places/${place.id}/forum-groups`, { name: "General", position: 10 });
  expect(groupResponse.status(), await groupResponse.text()).toBe(201);
  const group = await groupResponse.json() as { id: string };
  const forumResponse = await authorized(request, authentication.accessToken, "POST", `/places/${place.id}/forums`, { groupId: group.id, name: "Showcase", position: 10, visibility: "public" });
  expect(forumResponse.status(), await forumResponse.text()).toBe(201);
  const forum = await forumResponse.json() as { id: string };
  let topicId = "";
  const topicTitle = `What are you building ${placeSlug.slice(-5)}?`;
  if (options.withTopic !== false) {
    const topicResponse = await authorized(request, authentication.accessToken, "POST", `/places/${place.id}/forums/${forum.id}/topics`, {
      document: richText("A real API-backed browser test discussion."),
      tagIds: [],
      title: topicTitle,
    }, { "Idempotency-Key": crypto.randomUUID() });
    expect(topicResponse.status(), await topicResponse.text()).toBe(201);
    topicId = (await topicResponse.json() as { id: string }).id;
  }
  return { forumId: forum.id, placeId: place.id, placeName, placeSlug, topicId, topicTitle };
}

export async function createInvite(request: APIRequestContext, owner: E2eUser, placeId: string): Promise<string> {
  const authentication = await login(request, owner);
  const response = await authorized(request, authentication.accessToken, "POST", `/places/${placeId}/invites`, { expiresInHours: 24, maxUses: 1 });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json() as { token: string }).token;
}

export async function createDeletedReply(request: APIRequestContext, user: E2eUser, community: E2eCommunity): Promise<void> {
  const authentication = await login(request, user);
  const reply = await authorized(request, authentication.accessToken, "POST", `/places/${community.placeId}/topics/${community.topicId}/posts`, {
    document: richText("This reply will become a tombstone."),
  }, { "Idempotency-Key": crypto.randomUUID() });
  expect(reply.status(), await reply.text()).toBe(201);
  const postId = (await reply.json() as { id: string }).id;
  const deleted = await authorized(request, authentication.accessToken, "DELETE", `/places/${community.placeId}/posts/${postId}`);
  expect(deleted.status(), await deleted.text()).toBe(204);
}

export async function joinCommunity(request: APIRequestContext, user: E2eUser, placeId: string): Promise<void> {
  const authentication = await login(request, user);
  const response = await authorized(request, authentication.accessToken, "POST", `/places/${placeId}/join`, {});
  expect([200, 201]).toContain(response.status());
}

export async function createVoiceRoom(request: APIRequestContext, owner: E2eUser, placeId: string): Promise<E2eVoiceRoom> {
  const authentication = await login(request, owner);
  const response = await authorized(request, authentication.accessToken, "POST", `/places/${placeId}/voice/rooms`, {
    capacity: 1,
    listenPermission: "voice.join",
    name: "Studio voice",
    position: 0,
    slug: "studio-voice",
    speakPermission: "voice.join",
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

export async function createChatChannel(request: APIRequestContext, owner: E2eUser, placeId: string, name: string, position: number): Promise<E2eChatChannel> {
  const authentication = await login(request, owner);
  const response = await authorized(request, authentication.accessToken, "POST", `/places/${placeId}/chat/channels`, {
    name,
    position,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    visibility: "members",
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

export async function restrictVoiceSpeaking(request: APIRequestContext, owner: E2eUser, placeId: string, roomId: string): Promise<void> {
  const authentication = await login(request, owner);
  const response = await authorized(request, authentication.accessToken, "PATCH", `/places/${placeId}/voice/rooms/${roomId}`, {
    capacity: 1,
    listenPermission: "voice.join",
    name: "Studio voice",
    position: 0,
    speakPermission: "voice.manage",
  });
  expect(response.status(), await response.text()).toBe(200);
}

export function richText(text: string) {
  return { content: [{ content: [{ text, type: "text" }], type: "paragraph" }], type: "doc", version: 1 };
}

async function authorized(request: APIRequestContext, accessToken: string, method: "DELETE" | "PATCH" | "POST", path: string, data?: unknown, headers: Record<string, string> = {}) {
  return request.fetch(`${apiUrl}${path}`, { data, headers: { ...headers, Authorization: `Bearer ${accessToken}`, Origin: "http://localhost:3000" }, method });
}

async function mailToken(request: APIRequestContext, recipient: string, subject: string): Promise<string> {
  await expect.poll(async () => (await findMessageId(request, recipient, subject)) ?? "", { timeout: 15_000 }).not.toBe("");
  const id = await findMessageId(request, recipient, subject);
  if (!id) throw new Error(`Mail for ${recipient} was not found.`);
  const response = await request.get(`${mailpitUrl}/api/v1/message/${id}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  const message = await response.json() as { HTML?: string; Text?: string };
  const match = `${message.Text ?? ""}\n${message.HTML ?? ""}`.match(/[?&]token=([^\s<&"]+)/);
  if (!match?.[1]) throw new Error(`Token was not present in ${subject} mail for ${recipient}.`);
  return decodeURIComponent(match[1]);
}

async function findMessageId(request: APIRequestContext, recipient: string, subject: string): Promise<string | undefined> {
  const response = await request.get(`${mailpitUrl}/api/v1/messages`);
  if (!response.ok()) return undefined;
  const body = await response.json() as { messages?: Array<{ ID: string; Subject?: string; To?: Array<{ Address: string }> }> };
  return body.messages?.find((message) => message.Subject?.includes(subject) && message.To?.some((address) => address.Address === recipient))?.ID;
}

import { authenticatedMutation, authenticatedRead } from "@/features/auth/auth-client";
import type { ChatChannelContract, ChatMessageContract, ChatMessagePageContract } from "./chat-contracts";

const chatPath = (placeId: string) => `/places/${encodeURIComponent(placeId)}/chat`;

export function listChatChannels(placeId: string): Promise<ChatChannelContract[]> {
  return authenticatedRead(`${chatPath(placeId)}/channels`);
}

export function listChatMessages(placeId: string, channelId: string, cursor?: string): Promise<ChatMessagePageContract> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return authenticatedRead(`${chatPath(placeId)}/channels/${encodeURIComponent(channelId)}/messages${query}`);
}

export function sendChatMessage(placeId: string, channelId: string, body: string): Promise<ChatMessageContract> {
  return authenticatedMutation(`${chatPath(placeId)}/channels/${encodeURIComponent(channelId)}/messages`, {
    body: { body, clientCommandId: crypto.randomUUID() },
    method: "POST",
  });
}

export function editChatMessage(placeId: string, messageId: string, body: string): Promise<ChatMessageContract> {
  return authenticatedMutation(`${chatPath(placeId)}/messages/${encodeURIComponent(messageId)}`, { body: { body }, method: "PATCH" });
}

export function deleteChatMessage(placeId: string, messageId: string): Promise<void> {
  return authenticatedMutation(`${chatPath(placeId)}/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
}

export function markChatRead(placeId: string, channelId: string, messageId: string): Promise<void> {
  return authenticatedMutation(`${chatPath(placeId)}/channels/${encodeURIComponent(channelId)}/read`, { body: { messageId }, method: "PUT" });
}
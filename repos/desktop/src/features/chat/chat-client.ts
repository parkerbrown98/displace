import type { components } from '@displace/api-client';
import type { NativeAuthClient } from '../auth/auth-client';

export type ChatChannel = components['schemas']['ChatChannelDto'];
export type ChatMessage = components['schemas']['ChatMessageDto'];
export type ChatMessagePage = components['schemas']['ChatMessagePageDto'];

export class ChatClient {
  constructor(private readonly auth: NativeAuthClient) {}

  listChannels(placeId: string): Promise<ChatChannel[]> {
    return this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/chat/channels`);
  }

  listMessages(placeId: string, channelId: string, cursor?: string): Promise<ChatMessagePage> {
    const path = `/api/v1/places/${encodeURIComponent(placeId)}/chat/channels/${encodeURIComponent(channelId)}/messages`;
    return this.auth.authenticatedRequest(this.auth.api.pagePath(path, cursor));
  }

  send(placeId: string, channelId: string, body: string, clientCommandId = this.auth.api.createCommandId()): Promise<ChatMessage> {
    return this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/chat/channels/${encodeURIComponent(channelId)}/messages`, {
      body: { body, clientCommandId },
      headers: { 'Idempotency-Key': clientCommandId },
      method: 'POST',
    });
  }

  edit(placeId: string, messageId: string, body: string): Promise<ChatMessage> {
    return this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/chat/messages/${encodeURIComponent(messageId)}`, {
      body: { body },
      method: 'PATCH',
    });
  }

  delete(placeId: string, messageId: string): Promise<void> {
    return this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/chat/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
  }

  markRead(placeId: string, channelId: string, messageId: string): Promise<void> {
    return this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/chat/channels/${encodeURIComponent(channelId)}/read`, {
      body: { messageId },
      method: 'PUT',
    });
  }
}
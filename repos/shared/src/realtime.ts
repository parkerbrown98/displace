import type { components } from './schema.js';

export type RealtimeChatChannel = components['schemas']['ChatChannelDto'];
export type RealtimeChatMessage = components['schemas']['ChatMessageDto'];
export type RealtimeNotification = components['schemas']['NotificationDto'];
export type RealtimeNotificationPage = components['schemas']['NotificationPageDto'];
export type RealtimeVoiceRoom = components['schemas']['VoiceRoomDto'];

export interface JoinPlaceCommand {
  placeId: string;
}

export interface JoinChatCommand extends JoinPlaceCommand {
  channelId: string;
}

export interface SendChatMessageCommand extends JoinChatCommand {
  message: components['schemas']['CreateChatMessageDto'];
}

export interface EditChatMessageCommand extends JoinPlaceCommand {
  message: components['schemas']['UpdateChatMessageDto'];
  messageId: string;
}

export interface DeleteChatMessageCommand extends JoinPlaceCommand {
  messageId: string;
}

export interface MarkChatReadCommand extends JoinChatCommand {
  read: components['schemas']['MarkChatReadDto'];
}

export interface SetChatTypingCommand extends JoinChatCommand {
  active: boolean;
}

export interface WatchVoiceRoomCommand extends JoinPlaceCommand {
  roomId: string;
}

export interface ChatJoinedEvent {
  channelId: string;
}

export interface ChatTypingEvent extends ChatJoinedEvent {
  active: boolean;
  userId: string;
}

export interface PlacePresenceEvent {
  status: 'offline' | 'online';
  userId: string;
}

export interface VoiceRoomUpdatedEvent extends JoinPlaceCommand {
  roomId: string;
}

export interface VoiceWatchedEvent {
  roomId: string;
}

export type NotificationUpdatedEvent = RealtimeNotification & {
  dismissed?: boolean;
};

export interface ClientToServerEvents {
  'chat.delete': (command: DeleteChatMessageCommand) => void;
  'chat.edit': (command: EditChatMessageCommand) => void;
  'chat.join': (command: JoinChatCommand) => void;
  'chat.read': (command: MarkChatReadCommand) => void;
  'chat.send': (command: SendChatMessageCommand) => void;
  'chat.typing': (command: SetChatTypingCommand) => void;
  'notifications.sync': () => void;
  'place.join': (command: JoinPlaceCommand) => void;
  'presence.heartbeat': (command: JoinPlaceCommand) => void;
  'voice.watch': (command: WatchVoiceRoomCommand) => void;
}

export interface ServerToClientEvents {
  'chat.channel.updated': (channel: RealtimeChatChannel) => void;
  'chat.joined': (event: ChatJoinedEvent) => void;
  'chat.message.created': (message: RealtimeChatMessage) => void;
  'chat.message.updated': (message: RealtimeChatMessage) => void;
  'chat.typing': (event: ChatTypingEvent) => void;
  'notification.created': (notification: RealtimeNotification) => void;
  'notification.updated': (notification: NotificationUpdatedEvent) => void;
  'place.presence': (event: PlacePresenceEvent) => void;
  'voice.room.updated': (event: VoiceRoomUpdatedEvent) => void;
  'voice.watched': (event: VoiceWatchedEvent) => void;
}

export interface RealtimeSocketData {
  places: Set<string>;
  sessionId: string;
  userId: string;
}

export interface RealtimeInterServerEvents {}
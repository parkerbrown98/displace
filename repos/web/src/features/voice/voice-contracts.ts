import type { PlacePermission } from "@/features/places/place-contract";

export interface VoiceParticipantContract {
  canPublish: boolean;
  displayName: string;
  identity: string;
  joinedAt: string;
  microphoneMuted: boolean;
}

export interface VoiceRoomContract {
  archived: boolean;
  canJoin: boolean;
  canManage: boolean;
  canSpeak: boolean;
  capacity: number;
  id: string;
  listenPermission: PlacePermission;
  name: string;
  participants: VoiceParticipantContract[];
  placeId: string;
  position: number;
  slug: string;
  speakPermission: PlacePermission;
}

export interface VoiceRoomInput {
  capacity: number;
  listenPermission: PlacePermission;
  name: string;
  position: number;
  speakPermission: PlacePermission;
}

export interface CreateVoiceRoomInput extends VoiceRoomInput {
  slug: string;
}

export interface VoiceJoinContract {
  canPublish: boolean;
  expiresAt: string;
  roomName: string;
  serverUrl: string;
  token: string;
}
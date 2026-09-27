import type { components } from '@displace/api-client';
import type { PlacePermission } from "@/features/places/place-contract";

export type VoiceParticipantContract = components['schemas']['VoiceParticipantDto'];
export type VoiceRoomContract = components['schemas']['VoiceRoomDto'];

export interface VoiceRoomInput {
  capacity: number;
  listenPermission: PlacePermission;
  name: string;
  position: number;
  speakPermission: PlacePermission;
}

export type CreateVoiceRoomInput = components['schemas']['CreateVoiceRoomDto'];

export type VoiceJoinContract = components['schemas']['VoiceJoinDto'];
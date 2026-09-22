import { authenticatedMutation, authenticatedRead } from "@/features/auth/auth-client";
import type { CreateVoiceRoomInput, VoiceJoinContract, VoiceRoomContract, VoiceRoomInput } from "./voice-contracts";

const voicePath = (placeId: string) => `/places/${encodeURIComponent(placeId)}/voice`;

export function listVoiceRooms(placeId: string): Promise<VoiceRoomContract[]> {
  return authenticatedRead(`${voicePath(placeId)}/rooms`);
}

export function createVoiceRoom(placeId: string, input: CreateVoiceRoomInput): Promise<VoiceRoomContract> {
  return authenticatedMutation(`${voicePath(placeId)}/rooms`, { body: input, method: "POST" });
}

export function updateVoiceRoom(placeId: string, roomId: string, input: VoiceRoomInput): Promise<VoiceRoomContract> {
  return authenticatedMutation(`${voicePath(placeId)}/rooms/${encodeURIComponent(roomId)}`, { body: input, method: "PATCH" });
}

export function archiveVoiceRoom(placeId: string, roomId: string): Promise<void> {
  return authenticatedMutation(`${voicePath(placeId)}/rooms/${encodeURIComponent(roomId)}`, { method: "DELETE" });
}

export function createVoiceJoinToken(placeId: string, roomId: string): Promise<VoiceJoinContract> {
  return authenticatedMutation(`${voicePath(placeId)}/rooms/${encodeURIComponent(roomId)}/join-token`, { method: "POST" });
}
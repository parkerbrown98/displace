import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForumLiveSpaces } from "./forum-live-spaces";

const { listChatChannels, listVoiceRooms } = vi.hoisted(() => ({
  listChatChannels: vi.fn(),
  listVoiceRooms: vi.fn(),
}));

vi.mock("@/features/auth/session-provider", () => ({
  useSession: () => ({ status: "authenticated", user: { id: "viewer" } }),
}));
vi.mock("@/features/chat/chat-client", () => ({ listChatChannels }));
vi.mock("@/features/voice/voice-client", () => ({ listVoiceRooms }));

describe("ForumLiveSpaces", () => {
  beforeEach(() => {
    listChatChannels.mockResolvedValue([{ archived: false, id: "chat-id", name: "Lobby", position: 0, readPermission: null, sendPermission: null, slug: "lobby", visibility: "members" }]);
    listVoiceRooms.mockResolvedValue([{ archived: false, canJoin: true, canManage: false, canSpeak: true, capacity: 20, id: "voice-id", listenPermission: "voice.listen", name: "Lounge", participants: [{ canPublish: true, displayName: "Mara", identity: "user-id", joinedAt: "2026-09-22T12:00:00.000Z", microphoneMuted: false }], placeId: "place-id", position: 0, slug: "lounge", speakPermission: "voice.speak" }]);
  });

  it("links accessible chat and voice spaces through one live workspace", async () => {
    render(<ForumLiveSpaces placeId="place-id" placeSlug="game-makers" />);

    expect(await screen.findByRole("heading", { name: "Live spaces" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Live/ })).toHaveAttribute("href", "/places/game-makers/live");
    expect(screen.getByText("1 channel · 1 listening now")).toBeInTheDocument();
  });
});
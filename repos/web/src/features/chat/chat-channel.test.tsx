import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { placeContextFixture } from "@/features/places/place-fixtures";
import type { VoiceRoomContract } from "@/features/voice/voice-contracts";
import type { ChatChannelContract, ChatMessagePageContract } from "./chat-contracts";
import { LiveExperience } from "./chat-channel";

const mocks = vi.hoisted(() => ({
  listChatChannels: vi.fn(),
  listChatMessages: vi.fn(),
  voiceInstances: 0,
}));

vi.mock("@/features/auth/session-provider", () => ({ useSession: () => ({ status: "authenticated", user: { id: "viewer" } }) }));
vi.mock("@/features/moderation/report-button", () => ({ ReportButton: () => null }));
vi.mock("@/features/places/place-access", () => ({
  PlaceWorkspaceGate: ({ children }: { children: (value: { context: typeof placeContextFixture }) => React.ReactNode }) => children({ context: placeContextFixture }),
  placeErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("@/features/places/place-forum-header", () => ({ PlaceForumHeader: () => <div /> }));
vi.mock("@/features/realtime/realtime-client", () => ({ realtimeSocket: () => null }));
vi.mock("@/features/voice/voice-experience", async () => {
  const { useEffect, useState } = await import("react");
  return {
    PlaceVoicePanel: ({ onRoomsChanged, selectedRoomId }: { onRoomsChanged: (rooms: VoiceRoomContract[]) => void; selectedRoomId?: string }) => {
      const [instance] = useState(() => ++mocks.voiceInstances);
      useEffect(() => onRoomsChanged(voiceRooms), [onRoomsChanged]);
      const room = voiceRooms.find((item) => item.id === selectedRoomId) ?? voiceRooms[0]!;
      return <section><h2>{room.name}</h2><p>Audio session {instance}</p></section>;
    },
  };
});
vi.mock("./chat-client", () => ({
  deleteChatMessage: vi.fn(),
  editChatMessage: vi.fn(),
  listChatChannels: mocks.listChatChannels,
  listChatMessages: mocks.listChatMessages,
  markChatRead: vi.fn(),
  sendChatMessage: vi.fn(),
}));

const channels: ChatChannelContract[] = [
  { archived: false, id: "lobby-id", name: "Lobby", position: 0, readPermission: null, sendPermission: null, slug: "lobby", visibility: "members" },
  { archived: false, id: "workshop-id", name: "Workshop", position: 1, readPermission: null, sendPermission: null, slug: "workshop", visibility: "members" },
];

const voiceRooms: VoiceRoomContract[] = [{
  archived: false,
  canJoin: true,
  canManage: false,
  canSpeak: true,
  capacity: 20,
  id: "lounge-id",
  listenPermission: "voice.join",
  name: "Lounge",
  participants: [{ canPublish: true, displayName: "Mara", identity: "mara-id", joinedAt: "2026-09-23T12:00:00.000Z", microphoneMuted: false }],
  placeId: placeContextFixture.place.id,
  position: 0,
  slug: "lounge",
  speakPermission: "voice.join",
}];

function messagePage(channel: ChatChannelContract): ChatMessagePageContract {
  return { channel, items: [], permissions: { canManage: false, canSend: true } };
}

describe("LiveExperience", () => {
  beforeEach(() => {
    mocks.voiceInstances = 0;
    mocks.listChatChannels.mockResolvedValue(channels);
    mocks.listChatMessages.mockImplementation((_placeId: string, slug: string) => Promise.resolve(messagePage(channels.find((channel) => channel.slug === slug)!)));
  });

  it("switches between text and voice stages without remounting audio", async () => {
    const user = userEvent.setup();
    render(<LiveExperience placeSlug="game-makers" />);

    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Text Channels" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Voice Channels" })).toBeInTheDocument();
    expect(await screen.findByText("Mara")).toBeInTheDocument();
    expect(screen.getByText("Audio session 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Lounge/ }));
    expect(screen.getByRole("heading", { name: "Lounge" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Lobby" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Workshop" }));

    expect(await screen.findByRole("heading", { name: "Workshop" })).toBeInTheDocument();
    expect(screen.getByText("Audio session 1")).toBeInTheDocument();
    expect(mocks.voiceInstances).toBe(1);
  });
});

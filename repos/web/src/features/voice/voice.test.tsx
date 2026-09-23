import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticationFixture } from "@/features/auth/auth-fixtures";
import { resetAuthenticationForTests, signIn } from "@/features/auth/auth-client";
import { SessionProvider } from "@/features/auth/session-provider";
import { placeContextFixture } from "@/features/places/place-fixtures";
import { mockServer } from "@/test/mocks/server";
import { ToastProvider } from "@/components/ui/toast";
import type { VoiceRoomContract } from "./voice-contracts";
import { VoiceExperience } from "./voice-experience";
import { VoiceRoomSettings } from "./voice-room-settings";

vi.mock("@/features/places/place-forum-header", () => ({ PlaceForumHeader: () => <div /> }));
vi.mock("@/features/realtime/realtime-client", () => ({ realtimeSocket: () => null }));

const placeId = placeContextFixture.place.id;
const lounge: VoiceRoomContract = {
  archived: false,
  canJoin: true,
  canManage: true,
  canSpeak: true,
  capacity: 25,
  id: "01990000-7000-8000-8000-000000000201",
  listenPermission: "voice.join",
  name: "Lounge",
  participants: [],
  placeId,
  position: 1,
  slug: "lounge",
  speakPermission: "voice.join",
};

describe("voice experience", () => {
  beforeEach(async () => {
    mockServer.use(
      http.post("http://localhost:3001/api/v1/auth/login", () => HttpResponse.json(createAuthenticationFixture())),
      http.post("http://localhost:3001/api/v1/auth/refresh", () => HttpResponse.json(createAuthenticationFixture())),
    );
    await signIn({ identifier: "parker", password: "correct horse battery staple" });
  });

  afterEach(() => resetAuthenticationForTests());

  it("lists accessible rooms and surfaces an authoritative join denial", async () => {
    mockServer.use(
      http.get("http://localhost:3001/api/v1/places/game-makers/context", () => HttpResponse.json(placeContextFixture)),
      http.get(`http://localhost:3001/api/v1/places/${placeId}/voice/rooms`, () => HttpResponse.json([lounge])),
      http.post(`http://localhost:3001/api/v1/places/${placeId}/voice/rooms/${lounge.id}/join-token`, () => HttpResponse.json({ detail: "Voice room is full.", status: 409, title: "Conflict" }, { status: 409 })),
    );
    const user = userEvent.setup();
    render(<ToastProvider><SessionProvider><VoiceExperience placeSlug="game-makers" /></SessionProvider></ToastProvider>);

    expect(await screen.findByRole("heading", { name: "Lounge" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Join room" }));
    expect(await screen.findByText("Voice room is full.")).toBeInTheDocument();
  });

  it("creates a room with separate listen and speak permissions", async () => {
    let created: unknown;
    let rooms: VoiceRoomContract[] = [];
    mockServer.use(
      http.get(`http://localhost:3001/api/v1/places/${placeId}/voice/rooms`, () => HttpResponse.json(rooms)),
      http.post(`http://localhost:3001/api/v1/places/${placeId}/voice/rooms`, async ({ request }) => {
        created = await request.json();
        rooms = [lounge];
        return HttpResponse.json(lounge, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    render(<ToastProvider><VoiceRoomSettings context={placeContextFixture} onForbidden={vi.fn()} /></ToastProvider>);

    await screen.findByText("No voice rooms yet.");
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Town Hall");
    await user.clear(screen.getByLabelText("Room slug"));
    await user.type(screen.getByLabelText("Room slug"), "town-hall");
    fireEvent.click(screen.getByRole("combobox", { name: /Speak permission/ }));
    fireEvent.click(screen.getByRole("option", { name: "voice manage" }));
    await user.click(screen.getByRole("button", { name: "Create room" }));

    await waitFor(() => expect(created).toEqual({
      capacity: 25,
      listenPermission: "voice.join",
      name: "Town Hall",
      position: 0,
      slug: "town-hall",
      speakPermission: "voice.manage",
    }));
    expect(await screen.findByText("Voice room created.")).toBeInTheDocument();
  });
});
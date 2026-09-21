export interface PlaceContract {
  id: string;
  ownerUserId: string;
  slug: string;
  name: string;
  description: string;
  visibility: "private" | "public" | "unlisted";
  joinPolicy: "approval" | "invite_only" | "open";
  settings: Record<string, unknown>;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlacePageContract {
  items: PlaceContract[];
  nextCursor?: string;
}

export const placeContractFixture: PlaceContract = {
  id: "0199-0000-7000-8000-000000000001",
  ownerUserId: "0199-0000-7000-8000-000000000002",
  slug: "game-makers",
  name: "Game Makers",
  description: "Thoughtful discussion for people making games at every scale.",
  visibility: "public",
  joinPolicy: "open",
  settings: {},
  archivedAt: null,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

export const openSourcePlaceContractFixture: PlaceContract = {
  ...placeContractFixture,
  id: "01990000-7000-8000-8000-000000000003",
  ownerUserId: "01990000-7000-8000-8000-000000000004",
  slug: "open-source",
  name: "Open Source",
  description: "Maintainers and contributors building software in the open.",
};

export const soundDesignPlaceContractFixture: PlaceContract = {
  ...placeContractFixture,
  id: "01990000-7000-8000-8000-000000000005",
  ownerUserId: "01990000-7000-8000-8000-000000000006",
  slug: "sound-design",
  name: "Sound Design",
  description: "Recording, synthesis, implementation, and critical listening.",
};
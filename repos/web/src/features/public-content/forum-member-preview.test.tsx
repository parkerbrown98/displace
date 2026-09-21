import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memberFixture } from "@/features/places/place-fixtures";
import { ForumMemberPreview } from "./forum-member-preview";

const { listPlaceMembers } = vi.hoisted(() => ({ listPlaceMembers: vi.fn() }));

vi.mock("@/features/auth/session-provider", () => ({
  useSession: () => ({ status: "authenticated", user: { id: "viewer" } }),
}));
vi.mock("@/features/places/place-client", () => ({ listPlaceMembers }));

describe("ForumMemberPreview", () => {
  beforeEach(() => {
    listPlaceMembers.mockResolvedValue({
      items: [{ ...memberFixture, lastSeenAt: "2026-09-21T18:00:00.000Z" }],
    });
  });

  it("loads and links recently seen members", async () => {
    render(<ForumMemberPreview placeId="place-id" placeName="Game Makers" placeSlug="game-makers" />);

    expect(await screen.findByRole("heading", { name: "Recently seen" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mara V./ })).toHaveAttribute(
      "href",
      "/places/game-makers/members/01990000-7000-8000-8000-000000000020",
    );
    expect(listPlaceMembers).toHaveBeenCalledWith("place-id", "active", undefined, {
      limit: 5,
      sort: "last_seen",
    });
  });
});
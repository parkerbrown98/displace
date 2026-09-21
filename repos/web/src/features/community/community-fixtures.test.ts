import { describe, expect, it } from "vitest";
import { createCommunityFixture, type FixtureState } from "./community-fixtures";

describe("community fixtures", () => {
  it.each<FixtureState>([
    "anonymous",
    "deleted",
    "empty",
    "failed",
    "forbidden",
    "pending",
    "ready",
    "slow",
    "unauthenticated",
  ])("creates the %s state", (state) => {
    expect(createCommunityFixture(state).state).toBe(state);
  });

  it("does not share mutable nested values between requests", () => {
    const first = createCommunityFixture();
    const second = createCommunityFixture();
    first.place.slug = "changed";
    first.voiceRooms[0]?.people.push("ZZ");

    expect(second.place.slug).toBe("game-makers");
    expect(second.voiceRooms[0]?.people).not.toContain("ZZ");
  });
});
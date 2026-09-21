import { describe, expect, it } from "vitest";
import { placeContractFixture } from "./place-contract";
import { toPlaceViewModel } from "./place-view-model";

describe("toPlaceViewModel", () => {
  it("isolates display state from the API contract", () => {
    expect(toPlaceViewModel(placeContractFixture)).toEqual({
      id: placeContractFixture.id,
      name: "Game Makers",
      slug: "game-makers",
      description: placeContractFixture.description,
      isArchived: false,
      isPublic: true,
      joinPolicy: "open",
    });
  });
});
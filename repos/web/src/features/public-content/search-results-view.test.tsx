import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { placeContractFixture } from "@/features/places/place-fixtures";
import { DiscoveryView } from "./search-results-view";

describe("DiscoveryView", () => {
  it("preselects a place scope and focuses the scoped search", () => {
    render(<DiscoveryView placeId={placeContractFixture.id} selectedPlace={placeContractFixture} />);

    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveAttribute("placeholder", `Search in ${placeContractFixture.name}`);
    expect(screen.getByRole("combobox", { name: "Search scope" })).toHaveValue(placeContractFixture.id);
    expect(screen.getByRole("heading", { name: `Search in ${placeContractFixture.name}` })).toBeInTheDocument();
  });

  it("turns public tag facets into discovery navigation", () => {
    render(<DiscoveryView places={{
      items: [{ ...placeContractFixture, hasBanner: true, settings: { tags: ["game-design"] } }],
      tags: [{ count: 3, name: "game-design" }],
    }} />);

    expect(screen.getByRole("link", { name: "game design, 3 communities" })).toHaveAttribute("href", "/discover?tag=game-design");
    expect(screen.getByRole("link", { name: "#game-design" })).toHaveAttribute("href", "/discover?tag=game-design");
    expect(screen.getByRole("img", { name: "Game Makers banner" })).toHaveAttribute(
      "src",
      "http://localhost:3001/api/v1/public/places/0199-0000-7000-8000-000000000001/images/banner",
    );
  });
});
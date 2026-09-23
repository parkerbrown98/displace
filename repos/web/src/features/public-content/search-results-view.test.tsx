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
});
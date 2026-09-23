import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { notifyPlaceIconUpdated, PlaceIcon } from "./place-icon";

const place = {
  id: "01990000-7000-8000-8000-000000000001",
  name: "Game Makers",
  visibility: "public" as const,
};

describe("PlaceIcon", () => {
  it("uses the uploaded public place icon", () => {
    const { container } = render(<PlaceIcon className="place-mark" place={place} />);

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      `http://localhost:3001/api/v1/public/places/${place.id}/images/icon`,
    );
  });

  it("falls back to initials when the place icon is unavailable", () => {
    const { container } = render(<PlaceIcon className="place-mark" place={place} />);

    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("GM")).toHaveClass("place-mark");
  });

  it("retries a failed icon after an upload", () => {
    const { container } = render(<PlaceIcon className="place-mark" place={place} />);
    fireEvent.error(container.querySelector("img")!);

    act(() => notifyPlaceIconUpdated(place.id));

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      `http://localhost:3001/api/v1/public/places/${place.id}/images/icon?revision=1`,
    );
  });
});
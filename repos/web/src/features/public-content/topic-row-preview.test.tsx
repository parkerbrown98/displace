import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopicRowPreview } from "./topic-row-preview";

describe("TopicRowPreview", () => {
  it("renders a Lucide fallback for text-only discussions", () => {
    render(<TopicRowPreview placeId="place-id" previewImage={null} />);

    expect(screen.getByLabelText("Text discussion").querySelector("svg")).not.toBeNull();
  });

  it("renders the first post image and falls back when it cannot load", () => {
    render(<TopicRowPreview
      placeId="place-id"
      previewImage={{ alt: "Workbench sketch", assetId: "asset-id" }}
    />);

    const image = screen.getByRole("img", { name: "Workbench sketch" });
    expect(image).toHaveAttribute(
      "src",
      "http://localhost:3001/api/v1/public/places/place-id/images/posts/asset-id",
    );

    fireEvent.error(image);
    expect(screen.getByLabelText("Text discussion")).toBeInTheDocument();
  });
});
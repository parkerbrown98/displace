import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getAssetDownload } from "./asset-client";
import { AuthorizedAssetImage } from "./authorized-asset-image";

vi.mock("./asset-client", () => ({ getAssetDownload: vi.fn() }));

describe("AuthorizedAssetImage", () => {
  it("renders a fallback when the API denies asset access", async () => {
    vi.mocked(getAssetDownload).mockRejectedValue(new Error("Forbidden"));

    render(<AuthorizedAssetImage alt="Private diagram" assetId="asset-id" placeId="place-id" />);

    expect(await screen.findByText("Private diagram")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders the authorization-aware URL returned by the API", async () => {
    vi.mocked(getAssetDownload).mockResolvedValue({
      expiresInSeconds: 300,
      url: "https://objects.example.test/signed-download",
    });

    render(<AuthorizedAssetImage alt="Shared diagram" assetId="asset-id" placeId="place-id" />);

    expect(await screen.findByRole("img", { name: "Shared diagram" })).toHaveAttribute(
      "src",
      "https://objects.example.test/signed-download",
    );
  });
});
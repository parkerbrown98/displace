import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/problem-details";
import { getAssetDownload, getPlaceImage } from "./asset-client";
import { ImageUploader } from "./image-uploader";
import { uploadAsset } from "./upload-controller";

vi.mock("./asset-client", () => ({
  getAssetDownload: vi.fn(),
  getPlaceImage: vi.fn(),
  getProfileImage: vi.fn(),
}));
vi.mock("./upload-controller", () => ({ uploadAsset: vi.fn() }));

describe("ImageUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("rejects unsupported files before upload", () => {
    renderUploader();
    const input = screen.getByLabelText("Choose profile photo");

    fireEvent.change(input, {
      target: { files: [new File(["bad"], "payload.exe", { type: "application/octet-stream" })] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a JPEG, PNG, or WebP image.");
    expect(uploadAsset).not.toHaveBeenCalled();
  });

  it("uploads and assigns a selected image", async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    vi.mocked(uploadAsset).mockImplementation(async (_placeId, file, options) => {
      options?.onProgress?.({ percent: 100, stage: "ready" });
      return {
        createdAt: "2026-09-21T12:00:00.000Z",
        declaredMimeType: file.type,
        detectedMimeType: file.type,
        id: "asset-id",
        originalFileName: file.name,
        sizeBytes: file.size,
        status: "ready",
      };
    });
    vi.mocked(getAssetDownload).mockResolvedValue({
      expiresInSeconds: 300,
      url: "https://objects.example.test/photo.png",
    });
    renderUploader(onUploaded);
    const input = screen.getByLabelText("Choose profile photo");
    fireEvent.change(input, {
      target: { files: [new File(["image"], "photo.png", { type: "image/png" })] },
    });

    await user.click(screen.getByRole("button", { name: "Upload image" }));

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: "asset-id" })));
    expect(screen.getByRole("status")).toHaveTextContent("Image ready");
  });

  it("restores a persisted image when the uploader remounts", async () => {
    vi.mocked(getPlaceImage).mockResolvedValue({ assetId: "saved-asset-id", kind: "banner" });
    vi.mocked(getAssetDownload).mockResolvedValue({
      expiresInSeconds: 300,
      url: "https://objects.example.test/saved-banner.png",
    });

    render(
      <ImageUploader
        currentImage="place-banner"
        description="Shown on the place header."
        label="Place banner"
        onUploaded={vi.fn()}
        placeId="place-id"
        shape="landscape"
      />,
    );

    expect(await screen.findByRole("img", { name: "Selected upload preview" })).toHaveAttribute(
      "src",
      "https://objects.example.test/saved-banner.png",
    );
  });

  it.each([
    [413, "This place has reached its upload quota."],
    [410, "The upload intent expired."],
  ])("shows API detail for a %s upload failure", async (status, detail) => {
    const user = userEvent.setup();
    vi.mocked(uploadAsset).mockRejectedValue(new ApiError({ detail, status, title: "Upload failed" }));
    renderUploader();
    fireEvent.change(screen.getByLabelText("Choose profile photo"), {
      target: { files: [new File(["image"], "photo.png", { type: "image/png" })] },
    });

    await user.click(screen.getByRole("button", { name: "Upload image" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
  });

  it("allows retry after an object-store failure", async () => {
    const user = userEvent.setup();
    vi.mocked(uploadAsset).mockRejectedValue(new Error("The upload could not reach object storage."));
    renderUploader();
    fireEvent.change(screen.getByLabelText("Choose profile photo"), {
      target: { files: [new File(["image"], "photo.png", { type: "image/png" })] },
    });

    await user.click(screen.getByRole("button", { name: "Upload image" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not reach object storage");
    expect(screen.getByRole("button", { name: "Upload image" })).toBeEnabled();
  });
});

function renderUploader(onUploaded = vi.fn()) {
  return render(
    <ImageUploader
      description="Shown on your posts."
      label="Profile photo"
      onUploaded={onUploaded}
      placeId="place-id"
    />,
  );
}
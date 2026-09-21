import { describe, expect, it, vi } from "vitest";
import type { AssetContract, UploadIntentContract } from "./asset-contract";
import { AssetProcessingError, uploadAsset } from "./upload-controller";

describe("uploadAsset", () => {
  const file = new File(["image"], "photo.png", { type: "image/png" });
  const intent: UploadIntentContract = {
    expiresAt: "2026-09-21T12:15:00.000Z",
    id: "01997a4e-a200-7000-8000-000000000001",
    requiredHeaders: { "content-type": "image/png" },
    uploadUrl: "https://objects.example.test/upload",
  };
  const quarantined: AssetContract = {
    createdAt: "2026-09-21T12:00:00.000Z",
    declaredMimeType: "image/png",
    detectedMimeType: null,
    id: "01997a4e-a200-7000-8000-000000000002",
    originalFileName: "photo.png",
    sizeBytes: file.size,
    status: "quarantined",
  };

  it("uploads, completes, and polls until the asset is ready", async () => {
    const progress = vi.fn();
    const readAsset = vi
      .fn()
      .mockResolvedValueOnce({ ...quarantined, status: "processing" })
      .mockResolvedValueOnce({
        ...quarantined,
        detectedMimeType: "image/png",
        status: "ready",
      });

    await expect(
      uploadAsset(
        "place-id",
        file,
        { onProgress: progress },
        {
          complete: vi.fn().mockResolvedValue(quarantined),
          createIntent: vi.fn().mockResolvedValue(intent),
          delay: vi.fn().mockResolvedValue(undefined),
          readAsset,
          uploadObject: vi.fn(async (_intent, _file, onProgress) => {
            onProgress?.(55);
            onProgress?.(100);
          }),
        },
      ),
    ).resolves.toMatchObject({ status: "ready" });

    expect(readAsset).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenLastCalledWith({ percent: 100, stage: "ready" });
  });

  it("surfaces rejected processing without further polling", async () => {
    await expect(
      uploadAsset(
        "place-id",
        file,
        {},
        {
          complete: vi.fn().mockResolvedValue({ ...quarantined, status: "rejected" }),
          createIntent: vi.fn().mockResolvedValue(intent),
          delay: vi.fn().mockResolvedValue(undefined),
          readAsset: vi.fn(),
          uploadObject: vi.fn().mockResolvedValue(undefined),
        },
      ),
    ).rejects.toBeInstanceOf(AssetProcessingError);
  });
});
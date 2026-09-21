import {
  completeUpload,
  createUploadIntent,
  getAsset,
} from "./asset-client";
import type {
  AssetContract,
  UploadIntentContract,
  UploadProgress,
} from "./asset-contract";

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_MAX_POLLS = 60;

interface UploadDependencies {
  complete(placeId: string, intentId: string): Promise<AssetContract>;
  createIntent(
    placeId: string,
    file: Pick<File, "name" | "size" | "type">,
  ): Promise<UploadIntentContract>;
  delay(milliseconds: number, signal?: AbortSignal): Promise<void>;
  readAsset(placeId: string, assetId: string): Promise<AssetContract>;
  uploadObject(
    intent: UploadIntentContract,
    file: File,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;
}

export interface UploadAssetOptions {
  maxPolls?: number;
  onProgress?: (progress: UploadProgress) => void;
  pollIntervalMs?: number;
  signal?: AbortSignal;
}

export class AssetProcessingError extends Error {}

export async function uploadAsset(
  placeId: string,
  file: File,
  options: UploadAssetOptions = {},
  dependencies: UploadDependencies = defaultDependencies,
): Promise<AssetContract> {
  options.onProgress?.({ percent: 0, stage: "requesting" });
  const intent = await dependencies.createIntent(placeId, file);
  await dependencies.uploadObject(
    intent,
    file,
    (percent) => options.onProgress?.({ percent, stage: "uploading" }),
    options.signal,
  );
  let asset = await dependencies.complete(placeId, intent.id);
  options.onProgress?.({ percent: 100, stage: "processing" });

  const maxPolls = options.maxPolls ?? DEFAULT_MAX_POLLS;
  for (let poll = 0; asset.status !== "ready" && poll < maxPolls; poll += 1) {
    if (asset.status === "rejected") {
      throw new AssetProcessingError("The uploaded file did not pass validation.");
    }
    await dependencies.delay(
      options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      options.signal,
    );
    asset = await dependencies.readAsset(placeId, asset.id);
  }

  if (asset.status !== "ready") {
    throw new AssetProcessingError(
      "The upload is still processing. Try again in a moment.",
    );
  }
  options.onProgress?.({ percent: 100, stage: "ready" });
  return asset;
}

export function uploadObject(
  intent: UploadIntentContract,
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    request.open("PUT", intent.uploadUrl);
    for (const [name, value] of Object.entries(intent.requiredHeaders)) {
      if (name.toLowerCase() !== "content-length") {
        request.setRequestHeader(name, value);
      }
    }
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      signal?.removeEventListener("abort", abort);
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("The object store rejected the upload."));
    });
    request.addEventListener("error", () => {
      signal?.removeEventListener("abort", abort);
      reject(new Error("The upload could not reach object storage."));
    });
    request.addEventListener("abort", () => {
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("The upload was cancelled.", "AbortError"));
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    else request.send(file);
  });
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("The upload was cancelled.", "AbortError"));
      },
      { once: true },
    );
  });
}

const defaultDependencies: UploadDependencies = {
  complete: completeUpload,
  createIntent: createUploadIntent,
  delay,
  readAsset: getAsset,
  uploadObject,
};

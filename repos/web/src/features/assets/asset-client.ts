import { authenticatedMutation, authenticatedRead } from "@/features/auth/auth-client";
import type {
  AssetContract,
  AssetDownloadContract,
  AssetReferenceContract,
  CurrentAssetReferenceContract,
  UploadIntentContract,
} from "./asset-contract";

function assetPath(placeId: string): string {
  return `/places/${encodeURIComponent(placeId)}/assets`;
}

export function createUploadIntent(
  placeId: string,
  file: Pick<File, "name" | "size" | "type">,
): Promise<UploadIntentContract> {
  return authenticatedMutation(`${assetPath(placeId)}/upload-intents`, {
    body: { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
    method: "POST",
  });
}

export function completeUpload(
  placeId: string,
  intentId: string,
): Promise<AssetContract> {
  return authenticatedMutation(
    `${assetPath(placeId)}/upload-intents/${encodeURIComponent(intentId)}/complete`,
    { method: "POST" },
  );
}

export function getAsset(placeId: string, assetId: string): Promise<AssetContract> {
  return authenticatedRead(`${assetPath(placeId)}/${encodeURIComponent(assetId)}`);
}

export function getAssetDownload(
  placeId: string,
  assetId: string,
): Promise<AssetDownloadContract> {
  return authenticatedRead(
    `${assetPath(placeId)}/${encodeURIComponent(assetId)}/download`,
  );
}

export function getProfileImage(
  placeId: string,
  kind: "avatar" | "banner",
): Promise<CurrentAssetReferenceContract> {
  return authenticatedRead(`${assetPath(placeId)}/profile-images/${kind}`);
}

export function getPlaceImage(
  placeId: string,
  kind: "icon" | "banner",
): Promise<CurrentAssetReferenceContract> {
  return authenticatedRead(`${assetPath(placeId)}/place-images/${kind}`);
}

export function setProfileImage(
  placeId: string,
  kind: "avatar" | "banner",
  assetId: string,
): Promise<AssetReferenceContract> {
  return authenticatedMutation(
    `${assetPath(placeId)}/profile-images/${kind}`,
    { body: { assetId }, method: "PUT" },
  );
}

export function setPlaceImage(
  placeId: string,
  kind: "icon" | "banner",
  assetId: string,
): Promise<AssetReferenceContract> {
  return authenticatedMutation(
    `${assetPath(placeId)}/place-images/${kind}`,
    { body: { assetId }, method: "PUT" },
  );
}

import type { components } from '@displace/api-client';

export type AssetContract = components['schemas']['AssetDto'];
export type AssetStatus = AssetContract['status'];
export type UploadIntentContract = components['schemas']['UploadIntentDto'];
export type AssetDownloadContract = components['schemas']['AssetDownloadDto'];
export type AssetReferenceContract = components['schemas']['AssetReferenceDto'];
export type CurrentAssetReferenceContract = components['schemas']['CurrentAssetReferenceDto'];

export type UploadStage = "requesting" | "uploading" | "processing" | "ready";

export interface UploadProgress {
  percent: number;
  stage: UploadStage;
}

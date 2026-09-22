export type AssetStatus = "quarantined" | "processing" | "ready" | "rejected";

export interface AssetContract {
  createdAt: string;
  declaredMimeType: string;
  detectedMimeType: string | null;
  id: string;
  originalFileName: string;
  sizeBytes: number;
  status: AssetStatus;
}

export interface UploadIntentContract {
  expiresAt: string;
  id: string;
  requiredHeaders: Record<string, string>;
  uploadUrl: string;
}

export interface AssetDownloadContract {
  expiresInSeconds: number;
  url: string;
}

export interface AssetReferenceContract {
  assetId: string;
  kind: string;
}

export interface CurrentAssetReferenceContract {
  assetId: string | null;
  kind: string;
}

export type UploadStage = "requesting" | "uploading" | "processing" | "ready";

export interface UploadProgress {
  percent: number;
  stage: UploadStage;
}

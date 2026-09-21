export type AssetStatus = 'quarantined' | 'processing' | 'ready' | 'rejected';
export type UploadIntentStatus = 'pending' | 'completed' | 'expired';

export interface AssetRecord {
  createdAt: Date;
  declaredMimeType: string;
  detectedMimeType: string | null;
  id: string;
  originalFileName: string;
  objectKey: string;
  placeId: string;
  sizeBytes: number;
  status: AssetStatus;
  uploadedByUserId: string;
}

export interface UploadIntentRecord {
  assetId: string | null;
  createdAt: Date;
  expiresAt: Date;
  expectedMimeType: string;
  expectedSizeBytes: number;
  id: string;
  objectKey: string;
  originalFileName: string;
  placeId: string;
  status: UploadIntentStatus;
  userId: string;
}

export interface AssetUsage {
  placeBytes: number;
  userBytes: number;
}

export interface CreateUploadIntentRecord {
  expiresAt: Date;
  expectedMimeType: string;
  expectedSizeBytes: number;
  objectKey: string;
  originalFileName: string;
  placeId: string;
  userId: string;
}

export interface AssetsRepositoryPort {
  completeIntent(
    intentId: string,
    placeId: string,
    now: Date,
  ): Promise<AssetRecord>;
  findAsset(assetId: string, placeId: string): Promise<AssetRecord | undefined>;
  findIntent(
    intentId: string,
    placeId: string,
  ): Promise<UploadIntentRecord | undefined>;
  reserveIntent(
    input: CreateUploadIntentRecord,
    limits: { placeBytes: number; userBytes: number },
    now: Date,
  ): Promise<
    | { intent: UploadIntentRecord; quotaExceeded?: never }
    | { intent?: never; quotaExceeded: 'place' | 'user' }
  >;
  setPlaceImage(
    placeId: string,
    kind: 'icon' | 'banner',
    assetId: string,
    now: Date,
  ): Promise<{ assetId: string; kind: string } | undefined>;
  setUserImage(
    placeId: string,
    userId: string,
    kind: 'avatar' | 'banner',
    assetId: string,
    now: Date,
  ): Promise<{ assetId: string; kind: string } | undefined>;
}

export class UploadIntentExpiredError extends Error {}

export interface ObjectMetadata {
  contentLength?: number;
  contentType?: string;
  metadata: Record<string, string>;
}

export interface ObjectStoragePort {
  createDownloadUrl(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<string>;
  createUploadUrl(input: {
    contentLength: number;
    contentType: string;
    expiresInSeconds: number;
    metadata: Record<string, string>;
    objectKey: string;
  }): Promise<string>;
  headObject(objectKey: string): Promise<ObjectMetadata | undefined>;
}

export interface MediaQueuePort {
  enqueue(assetId: string, placeId: string): Promise<void>;
}

export const MEDIA_QUEUE_NAME = 'media';

export interface ProcessAssetJob {
  assetId: string;
  kind: 'asset.process';
  placeId: string;
}

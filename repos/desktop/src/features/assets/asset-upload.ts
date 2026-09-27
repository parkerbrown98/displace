import type { components } from '@displace/api-client';
import type { NativeAuthClient } from '../auth/auth-client';

export type Asset = components['schemas']['AssetDto'];
type UploadIntent = components['schemas']['UploadIntentDto'];

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface UploadProgress {
  percent: number;
  stage: 'requesting' | 'uploading' | 'processing' | 'ready';
}

export interface UploadOptions {
  maxPolls?: number;
  onProgress?: (progress: UploadProgress) => void;
  pollIntervalMs?: number;
  signal?: AbortSignal;
}

export class AssetProcessingError extends Error {}

export function imageFileError(file: Pick<File, 'size' | 'type'>): string | undefined {
  if (!IMAGE_MIME_TYPES.has(file.type.toLowerCase())) return 'Choose a JPEG, PNG, or WebP image.';
  if (file.size > MAX_IMAGE_BYTES) return 'Images must be 25 MB or smaller.';
  return undefined;
}

export async function uploadAsset(auth: NativeAuthClient, placeId: string, file: File, options: UploadOptions = {}): Promise<Asset> {
  const basePath = `/api/v1/places/${encodeURIComponent(placeId)}/assets`;
  options.onProgress?.({ percent: 0, stage: 'requesting' });
  const intent = await auth.authenticatedRequest<UploadIntent>(`${basePath}/upload-intents`, {
    body: { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
    method: 'POST',
  });
  if (new Date(intent.expiresAt).getTime() <= Date.now()) throw new AssetProcessingError('The upload authorization expired. Try again.');
  await uploadObject(intent, file, (percent) => options.onProgress?.({ percent, stage: 'uploading' }), options.signal);
  let asset = await auth.authenticatedRequest<Asset>(`${basePath}/upload-intents/${encodeURIComponent(intent.id)}/complete`, { method: 'POST' });
  options.onProgress?.({ percent: 100, stage: 'processing' });
  const maxPolls = options.maxPolls ?? 60;
  for (let poll = 0; asset.status !== 'ready' && poll < maxPolls; poll += 1) {
    if (asset.status === 'rejected') throw new AssetProcessingError('The image did not pass server validation.');
    await delay(options.pollIntervalMs ?? 1_000, options.signal);
    asset = await auth.authenticatedRequest<Asset>(`${basePath}/${encodeURIComponent(asset.id)}`);
  }
  if (asset.status !== 'ready') throw new AssetProcessingError('The image is still processing. Retry in a moment.');
  options.onProgress?.({ percent: 100, stage: 'ready' });
  return asset;
}

function uploadObject(intent: UploadIntent, file: File, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    request.open('PUT', intent.uploadUrl);
    for (const [name, value] of Object.entries(intent.requiredHeaders)) {
      if (name.toLowerCase() !== 'content-length') request.setRequestHeader(name, value);
    }
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('The object store rejected the upload.')));
    request.addEventListener('error', () => reject(new Error('The upload could not reach object storage.')));
    request.addEventListener('abort', () => reject(new DOMException('The upload was cancelled.', 'AbortError')));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    else request.send(file);
  });
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timeout);
      reject(new DOMException('The upload was cancelled.', 'AbortError'));
    }, { once: true });
  });
}
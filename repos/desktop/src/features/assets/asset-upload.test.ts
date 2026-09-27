import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeAuthClient } from '../auth/auth-client';
import { AssetProcessingError, imageFileError, MAX_IMAGE_BYTES, uploadAsset } from './asset-upload';

class SuccessfulRequest {
  status = 200;
  upload = { addEventListener: (_name: string, listener: (event: ProgressEvent) => void) => { this.progressListener = listener; } };
  private listeners = new Map<string, () => void>();
  private progressListener?: (event: ProgressEvent) => void;
  addEventListener(name: string, listener: () => void) { this.listeners.set(name, listener); }
  abort() { this.listeners.get('abort')?.(); }
  open() {}
  send() { this.progressListener?.({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent); this.listeners.get('load')?.(); }
  setRequestHeader() {}
}

describe('asset upload', () => {
  beforeEach(() => { vi.stubGlobal('XMLHttpRequest', SuccessfulRequest); });

  it('validates editor image type and size', () => {
    expect(imageFileError({ size: 1, type: 'application/pdf' })).toMatch(/JPEG/);
    expect(imageFileError({ size: MAX_IMAGE_BYTES + 1, type: 'image/png' })).toMatch(/25 MB/);
    expect(imageFileError({ size: MAX_IMAGE_BYTES, type: 'image/webp' })).toBeUndefined();
  });

  it('uploads directly and completes with the server asset id', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ expiresAt: '2999-01-01T00:00:00Z', id: 'intent-1', requiredHeaders: { 'Content-Type': 'image/png' }, uploadUrl: 'https://upload.test/object' })
      .mockResolvedValueOnce({ id: 'asset-1', status: 'ready', originalFileName: 'image.png' });
    const progress = vi.fn();
    const result = await uploadAsset({ authenticatedRequest: request } as unknown as NativeAuthClient, 'place-1', new File(['image'], 'image.png', { type: 'image/png' }), { onProgress: progress });
    expect(result.id).toBe('asset-1');
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/places/place-1/assets/upload-intents/intent-1/complete', { method: 'POST' });
    expect(progress).toHaveBeenCalledWith({ percent: 100, stage: 'ready' });
  });

  it('rejects expired intents and rejected or stalled processing', async () => {
    const file = new File(['image'], 'image.png', { type: 'image/png' });
    const expired = vi.fn().mockResolvedValue({ expiresAt: '2000-01-01T00:00:00Z', id: 'expired', requiredHeaders: {}, uploadUrl: 'https://upload.test' });
    await expect(uploadAsset({ authenticatedRequest: expired } as unknown as NativeAuthClient, 'place-1', file)).rejects.toBeInstanceOf(AssetProcessingError);

    const rejected = vi.fn()
      .mockResolvedValueOnce({ expiresAt: '2999-01-01T00:00:00Z', id: 'intent-1', requiredHeaders: {}, uploadUrl: 'https://upload.test' })
      .mockResolvedValueOnce({ id: 'asset-1', status: 'rejected' });
    await expect(uploadAsset({ authenticatedRequest: rejected } as unknown as NativeAuthClient, 'place-1', file)).rejects.toThrow(/validation/);

    const stalled = vi.fn()
      .mockResolvedValueOnce({ expiresAt: '2999-01-01T00:00:00Z', id: 'intent-1', requiredHeaders: {}, uploadUrl: 'https://upload.test' })
      .mockResolvedValueOnce({ id: 'asset-1', status: 'processing' });
    await expect(uploadAsset({ authenticatedRequest: stalled } as unknown as NativeAuthClient, 'place-1', file, { maxPolls: 0 })).rejects.toThrow(/still processing/);
  });

  it('cancels the object upload through AbortSignal', async () => {
    const request = vi.fn().mockResolvedValue({ expiresAt: '2999-01-01T00:00:00Z', id: 'intent-1', requiredHeaders: {}, uploadUrl: 'https://upload.test' });
    const controller = new AbortController();
    controller.abort();
    await expect(uploadAsset({ authenticatedRequest: request } as unknown as NativeAuthClient, 'place-1', new File(['image'], 'image.png', { type: 'image/png' }), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
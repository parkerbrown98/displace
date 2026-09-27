import { describe, expect, it } from 'vitest';
import { MemoryNativePlatform } from './native-platform';

describe('MemoryNativePlatform', () => {
  it('models credential presence without exposing the stored token', async () => {
    const platform = new MemoryNativePlatform();
    expect(await platform.hasRefreshToken()).toBe(false);
    await platform.storeRefreshToken('secret');
    expect(await platform.hasRefreshToken()).toBe(true);
    expect(await platform.inspectRefreshToken()).toBe('secret');
    await platform.clearRefreshToken();
    expect(await platform.hasRefreshToken()).toBe(false);
    expect(await platform.inspectRefreshToken()).toBeNull();
  });
});
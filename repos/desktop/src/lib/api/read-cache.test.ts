import { describe, expect, it, vi } from 'vitest';
import { ReadCache } from './read-cache';

describe('ReadCache', () => {
  it('clears authorization-sensitive entries without discarding public reads', async () => {
    const cache = new ReadCache();
    const reloadPublic = vi.fn(async () => 'public-reloaded');
    const reloadPrivate = vi.fn(async () => 'private-reloaded');

    await cache.getOrLoad('public:place', async () => 'public');
    await cache.getOrLoad('place:one:context', async () => 'private', true);
    cache.clearSensitive();

    await expect(cache.getOrLoad('public:place', reloadPublic)).resolves.toBe('public');
    await expect(cache.getOrLoad('place:one:context', reloadPrivate, true)).resolves.toBe('private-reloaded');
    expect(reloadPublic).not.toHaveBeenCalled();
    expect(reloadPrivate).toHaveBeenCalledOnce();
  });

  it('evicts the least recently used entry when capacity is reached', async () => {
    const cache = new ReadCache(2);
    const reload = vi.fn(async () => 'reloaded');

    await cache.getOrLoad('first', async () => 'first');
    await cache.getOrLoad('second', async () => 'second');
    await cache.getOrLoad('first', async () => 'unused');
    await cache.getOrLoad('third', async () => 'third');

    await expect(cache.getOrLoad('second', reload)).resolves.toBe('reloaded');
    expect(reload).toHaveBeenCalledOnce();
  });
});
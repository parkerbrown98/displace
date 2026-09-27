interface CacheEntry {
  expiresAt: number;
  sensitive: boolean;
  value: unknown;
}

export class ReadCache {
  readonly #entries = new Map<string, CacheEntry>();

  constructor(
    private readonly capacity = 80,
    private readonly ttlMs = 120_000,
  ) {}

  async getOrLoad<T>(key: string, loader: () => Promise<T>, sensitive = false): Promise<T> {
    const cached = this.#entries.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.#entries.delete(key);
      this.#entries.set(key, cached);
      return cached.value as T;
    }
    if (cached) this.#entries.delete(key);

    const value = await loader();
    this.#entries.set(key, { expiresAt: Date.now() + this.ttlMs, sensitive, value });
    while (this.#entries.size > this.capacity) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.#entries.delete(oldest);
    }
    return value;
  }

  clearSensitive(): void {
    for (const [key, entry] of this.#entries) {
      if (entry.sensitive) this.#entries.delete(key);
    }
  }

  deletePrefix(prefix: string): void {
    for (const key of this.#entries.keys()) {
      if (key.startsWith(prefix)) this.#entries.delete(key);
    }
  }
}

export const desktopReadCache = new ReadCache();
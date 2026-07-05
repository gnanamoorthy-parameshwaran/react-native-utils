import type { APICacheDriver, CacheEntry } from '../types';

export default class MemoryCacheDriver implements APICacheDriver {
  protected cache: Map<string, CacheEntry>;

  constructor() {
    this.cache = new Map();
  }

  get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    if (!entry) return Promise.resolve(undefined);

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return Promise.resolve(undefined);
    }

    return Promise.resolve(entry.value as T);
  }

  set(key: string, value: unknown, ttl: number): Promise<void> {
    this.cache.set(key, { value, expiresAt: Date.now() + ttl });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.cache.delete(key);
    return Promise.resolve();
  }

  deleteAll(): Promise<void> {
    this.cache.clear();
    return Promise.resolve();
  }
}

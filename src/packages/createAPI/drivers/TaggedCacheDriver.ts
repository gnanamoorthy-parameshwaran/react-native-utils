import type {APICacheDriver} from '../types';

const TAG_INDEX_PREFIX = '__tag__:';
// Index entries track membership, not data -- they should outlive every entry
// they point to, so member lookups during invalidateTag never miss a key.
const TAG_INDEX_TTL = Number.MAX_SAFE_INTEGER;

/**
 * Wraps any `APICacheDriver` to add tag-based group invalidation, without
 * requiring the underlying driver to support key enumeration or prefix
 * matching. Tag membership is tracked as an ordinary cache entry (an array of
 * keys) under a reserved `__tag__:<tag>` key, written through the same
 * get/set/delete surface every driver already implements.
 */
export default class TaggedCacheDriver implements APICacheDriver {
    constructor(private readonly driver: APICacheDriver) {}

    get<T>(key: string): Promise<T | undefined> {
        return this.driver.get<T>(key);
    }

    async set(key: string, value: unknown, ttl: number, tags: string[] = []): Promise<void> {
        await this.driver.set(key, value, ttl);
        await Promise.all(tags.map(tag => this.addToTagIndex(tag, key)));
    }

    delete(key: string): Promise<void> {
        return this.driver.delete(key);
    }

    deleteAll(): Promise<void> {
        return this.driver.deleteAll();
    }

    async invalidateTag(tag: string): Promise<void> {
        const indexKey = TAG_INDEX_PREFIX + tag;
        const members = (await this.driver.get<string[]>(indexKey)) ?? [];
        await Promise.all(members.map(key => this.driver.delete(key)));
        await this.driver.delete(indexKey);
    }

    private async addToTagIndex(tag: string, key: string): Promise<void> {
        const indexKey = TAG_INDEX_PREFIX + tag;
        const members = (await this.driver.get<string[]>(indexKey)) ?? [];
        if (!members.includes(key)) {
            await this.driver.set(indexKey, [...members, key], TAG_INDEX_TTL);
        }
    }
}

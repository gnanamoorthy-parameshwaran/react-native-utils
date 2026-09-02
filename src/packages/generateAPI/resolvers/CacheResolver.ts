import type {Operation} from '../types/OpenAPISpec.ts';
import type {HttpMethodKey, ResolvedCache} from '../types/ResolvedOperation.ts';

export default class CacheResolver {
    /**
     * Reads the `x-cache-config` vendor extension (e.g. `{ "ttl": 300000, "tags": ["business-units"] }`,
     * ttl in ms) to decide whether a generated GET should carry a cacheConfig +
     * invalidate helper. Query params are allowed -- the generated cache key
     * folds them in, so each params combination (e.g. each paginated page)
     * caches under its own key rather than colliding.
     */
    public resolve(method: HttpMethodKey, operation: Operation): ResolvedCache | undefined {
        if (method !== 'get') return undefined;

        const raw = operation['x-cache-config'];
        if (typeof raw !== 'object' || !raw) return undefined;

        const ttl = Number(raw.ttl);
        if (!Number.isFinite(ttl)) return undefined;

        const tags = Array.isArray(raw.tags) ? raw.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : undefined;
        return tags && tags.length > 0 ? {ttl, tags} : {ttl};
    }
}

import type {Operation} from '../types/OpenAPISpec.ts';
import type {HttpMethodKey, ResolvedCache, ResolvedQueryParam} from '../types/ResolvedOperation.ts';

export default class CacheResolver {
    /**
     * Reads the `x-cache-config` vendor extension (e.g. `{ "ttl": 300 }`, seconds)
     * to decide whether a generated GET should carry a cacheConfig + invalidate
     * helper. Only applies to GETs with no query params -- caching a paginated
     * list isn't supported yet, so it's deliberately ignored there for now.
     */
    public resolve(method: HttpMethodKey, operation: Operation, queryParams: ResolvedQueryParam[]): ResolvedCache | undefined {
        if (method !== 'get' || queryParams.length > 0) return undefined;

        const raw = operation['x-cache-config'];
        const ttl = typeof raw === 'object' && raw ? Number(raw.ttl) : NaN;
        return Number.isFinite(ttl) ? {ttl} : undefined;
    }
}

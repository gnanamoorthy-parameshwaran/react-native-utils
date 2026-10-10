# react-native-utils

Used to store the common utilities for react native app

## Installation

```sh
npm install @gnanamoorthy/react-native-utils
```

## Usage

### API client with cached queries

```ts
// src/hooks/useAPI.ts
import {createAPI} from '@gnanamoorthy/react-native-utils';

const {useAPI, useQuery, invalidateQueries} = createAPI({
    baseURL: 'https://api.example.com',
    queryTtl: 60_000, // default cache lifetime for queries (ms); 0 = no caching
});

export {useQuery, invalidateQueries};
export default useAPI;
```

```tsx
// Cached for `ttl` ms per query key; a remount within the ttl renders from cache
const {data, error, isLoading, refetch} = useQuery({
    queryKey: ['posts', {id}],
    queryFn: ({request}) => request<Post>({endpoint: `/posts/${id}`}),
    enabled: !!id, // optional: don't fetch until true
});

// Plain, uncached requests (mutations)
const {loading, request} = useAPI();
await request({method: 'PUT', endpoint: `/posts/${id}`, body: JSON.stringify(post)});

invalidateQueries(['posts', {id}]); // just this post
invalidateQueries(['posts']);       // every cached post; mounted ones refetch
```

Components on the same key share one in-flight request. The query cache is in memory only.
Pagination helpers and infinite queries are not implemented yet.

### Generating typed hooks from OpenAPI

```sh
npx @gnanamoorthy/react-native-utils generate-client --config ./client-generator.config.json
```

See [docs/requirement.md](docs/requirement.md) for the config and the generated output.

### Migrating from 1.x

- `createAPI()` now returns `{useAPI, useQuery, invalidateQueries}` instead of the `useAPI` hook
  itself.
- `useAPI()` returns `{loading, request}`. `cacheConfig`, `invalidateCache` and
  `invalidateCacheGroup` are gone:
    - `request({..., cacheConfig: {ttl}})` becomes `useQuery({queryKey, queryFn, ttl})`.
    - `invalidateCache(key)` / `invalidateCacheGroup(tag)` become `invalidateQueries(queryKey)`,
      which clears every query whose key starts with it.
- `getCacheKey`, the `cache` option and the cache drivers (`MemoryCacheDriver`,
  `AsyncStorageCacheDriver`, `TaggedCacheDriver`) were removed. The query cache is in memory only.
- Regenerate clients. Generated clients are now plain API clients: their `invalidate…` helpers and
  `cacheConfig` are gone, and `x-cache-config` is ignored. Cache at page level by calling a
  generated method inside `useQuery`.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)

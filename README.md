# react-native-utils

Used to store the common utilities for react native app

New to the API layer? Read [Why createAPI, useAPI, useQuery and generateAPI](docs/api-layer.md)
for the problems each piece solves compared with calling `fetch` directly.

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
    staleTime: 60_000, // optional: how long data is fresh (ms); default 0 = revalidate on every mount
    cacheTime: 5 * 60_000, // optional: how long unused data stays in memory (ms); this is the default
});

export {useQuery, invalidateQueries};
export default useAPI;
```

```tsx
// Fresh for `staleTime`: a remount renders from cache with no request. After that, cached data is still
// shown instantly while it revalidates in the background (isFetching), until `cacheTime` drops it.
const {data, error, isLoading, refetch} = useQuery({
    queryKey: ['posts', {id}],
    queryFn: ({request}) => request<Post>({endpoint: `/posts/${id}`}),
    enabled: !!id, // optional: don't fetch until true
});

// Page-number pagination: each page caches separately; the previous page stays visible while the
// next loads. isLoading = nothing to show yet, isFetching = any request in flight.
const {data: posts, isFetching, isPlaceholderData} = useQuery({
    queryKey: ['posts', {page}],
    queryFn: ({request}) => request<Post[]>({endpoint: `/posts?page=${page}`}),
    keepPreviousData: true,
});

// Plain, uncached requests (mutations)
const {loading, request} = useAPI();
await request({method: 'PUT', endpoint: `/posts/${id}`, body: JSON.stringify(post)});

invalidateQueries(['posts', {id}]); // just this post
invalidateQueries(['posts']);       // every cached post; mounted ones refetch
```

Components on the same key share one in-flight request. The query cache is in memory only.

To fetch again when a screen regains focus, pass your navigation library's focus hook once. Screens
don't import it. A query revalidates on focus only if its data is stale, and `invalidateQueries`
refetches only the focused screen; background screens fetch when you return to them:

```ts
import {useFocusEffect} from '@react-navigation/native';

createAPI({baseURL: 'https://api.example.com', staleTime: 60_000, useFocusEffect});
```
Infinite queries (append-as-you-scroll lists) are not implemented yet.

### Generating typed hooks from OpenAPI

```sh
npx @gnanamoorthy/react-native-utils generate-client --config ./client-generator.config.json
```

See [docs/requirement.md](docs/requirement.md) for the config and the generated output.

### AI assistant skill

The package ships an [Agent Skill](https://agentskills.io) that teaches AI coding assistants how to
use `createAPI`, `useAPI`, `useQuery` and the generator. Install it into your project:

```sh
npx @gnanamoorthy/react-native-utils add-skill                 # -> .claude/skills/react-native-utils
npx @gnanamoorthy/react-native-utils add-skill --dir <path>    # another agent's skills directory
```

Commit the installed folder so everyone on the project gets it, and re-run the command after
upgrading the package to keep the instructions in step with the installed version.

### Migrating from 1.x

- `createAPI()` now returns `{useAPI, useQuery, invalidateQueries}` instead of the `useAPI` hook
  itself.
- `useAPI()` returns `{loading, request}`. `cacheConfig`, `invalidateCache` and
  `invalidateCacheGroup` are gone:
    - `request({..., cacheConfig: {ttl}})` becomes `useQuery({queryKey, queryFn, staleTime})`.
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

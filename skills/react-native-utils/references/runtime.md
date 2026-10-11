# createAPI runtime: createAPI, useAPI, useQuery

Source, if behaviour needs checking: `node_modules/@gnanamoorthy/react-native-utils/src/packages/createAPI/client.ts` (all runtime logic) and
`node_modules/@gnanamoorthy/react-native-utils/src/packages/createAPI/types.ts` (exact shapes).

## Contents

- Setup
- `useAPI`
- `useQuery`
- `useInfiniteQuery`
- `invalidateQueries`
- Behaviour (for debugging)
- Not implemented yet

## Setup

One `createAPI({...})` call per app, re-exported from a project file (convention:
`src/hooks/useAPI.ts`). The generator's
`useAPIImportPath` points at this file and needs `useAPI` as its **default** export. `useQuery` and
`invalidateQueries` are named exports for screens. Full annotated setup:
[../examples/create-api-setup.ts](../examples/create-api-setup.ts).

`createAPI` options:

| Option                                                   | Purpose                                                                                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseURL`                                                | Prefixed to every `endpoint`                                                                                                                                      |
| `onBeforeRequest({headers, emitEvent})`                  | Return `{headers}`; e.g. attach the auth token                                                                                                                    |
| `onAfterResponse({response, retry, attempt, emitEvent})` | Return a `Response`; call `retry()` to resend, e.g. after refreshing a token on 401                                                                               |
| `maxRetries`                                             | Upper bound for `retry()` (default 1)                                                                                                                             |
| `throwException`                                         | Throw typed `API*Error` classes on non-2xx instead of returning the body                                                                                          |
| `onError({error, url, options, response, emitEvent})`    | Central error reporting; the error is rethrown afterwards                                                                                                         |
| `staleTime`                                              | Default `staleTime` (ms) for queries that don't set one; default 0 = revalidate on every mount                                                                    |
| `cacheTime`                                              | Default `cacheTime` (ms) for queries that don't set one; default 5 minutes                                                                                        |
| `useFocusEffect`                                         | Optional focus hook, e.g. React Navigation's, for focus-aware queries                                                                                             |
| `revalidateOnAppForeground`                              | Opt-in: revalidate stale or failed queries on screen when the app returns to the foreground (React Native `AppState`)                                             |
| `subscribeToNetwork`                                     | Opt-in: `listener => NetInfo.addEventListener(state => listener(!!state.isConnected))`; revalidates stale or failed queries on screen when the network comes back |

Wrap the app root in `APIContextWrapper emitEvent={...}` so `emitEvent` reaches a handler (e.g. to log
out when a session expires).

With `throwException: true`, a `422` throws `APIValidationError` carrying the backend's field
errors; other statuses map to classes in `node_modules/@gnanamoorthy/react-native-utils/src/packages/createAPI/exceptions.ts`.

## `useAPI`

```ts
const {loading, request} = useAPI();
await request<Thing>({method: 'POST', endpoint: '/v1/things', body: JSON.stringify(input)});
```

`request` runs the `createAPI` pipeline. A single call can override `headers`, `onBeforeRequest`,
`onAfterResponse`, `onBeforeResult` (custom response parsing), `maxRetries` and `signal`.

## `useQuery`

```ts
const {data, error, isLoading, isFetching, isPlaceholderData, refetch} = useQuery({
    queryKey: ['things', {page}], // serializable array; object key order doesn't matter
    queryFn: ({request}) => request<Thing[]>({endpoint: `/v1/things?page=${page}`}),
    staleTime: 300_000, // ms the data is fresh: served from cache with no request
    cacheTime: 600_000, // ms unused data stays in memory (stale data is shown while it revalidates)
    enabled: !!userId, // lazy: don't fetch until true
    keepPreviousData: true, // pagination: keep the previous page while the next loads
    onSuccess: data => {},
    onError: error => {},
});
```

- `request` in `queryFn` is `useAPI`'s request without the loading state. A generated client method
  can be called instead (see [../examples/generated-client-query.tsx](../examples/generated-client-query.tsx)).
- Result flags:
    - `isLoading`: fetching with nothing to show yet.
    - `isFetching`: any request in flight, including refetches over existing data.
    - `isPlaceholderData`: `data` is the previous key's data under `keepPreviousData`.
- `refetch()` always hits the network.

Paged screen example: [../examples/paged-query.tsx](../examples/paged-query.tsx).

## `useInfiniteQuery`

For lists that load page by page as they scroll. Full example:
[../examples/infinite-list.tsx](../examples/infinite-list.tsx).

```ts
const {data, isLoading, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, refetch} = useInfiniteQuery({
    queryKey: ['posts', 'infinite'],
    queryFn: ({request, pageParam}) => request<Page>({endpoint: `/posts?page=${pageParam}`}),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => (lastPage.meta.current_page < lastPage.meta.last_page ? lastPageParam + 1 : undefined),
});
// data: {pages: Page[], pageParams: number[]}; render data?.pages.flatMap(page => page.data)
```

- Takes the same `staleTime`, `cacheTime`, `enabled`, `onSuccess` and `onError` options as `useQuery`
  (no `keepPreviousData`).
- The whole list is **one cache entry** under its key, so stale time, cache time, invalidation,
  deduplication and structural sharing apply to the list as a whole.
- `fetchNextPage()` appends the page `getNextPageParam` points to. It does nothing when
  `hasNextPage` is false or any request for the list is running, so it is safe to call from
  `onEndReached`.
- `isFetchingNextPage` is true only while a next page loads; use `isFetching && !isFetchingNextPage`
  for a pull-to-refresh indicator.
- Any refresh (stale revalidation on mount, focus, foreground or reconnect; `invalidateQueries`;
  `refetch()`) reloads **only the first page**, replacing the list. There is no page limit and
  loading is forward only.

## `invalidateQueries`

```ts
await invalidateQueries(['things', {id}]); // one entry
await invalidateQueries(['things']); // every key starting with 'things'
await invalidateQueries(); // everything
```

Matching is by prefix, and object segments match partially: `['things', {userId: 1}]` also matches
`['things', {userId: 1, page: 2}]`. Matching cache entries are marked stale and matching in-flight requests dropped, then
matching queries that are mounted, enabled and focused refetch.

## Behaviour (for debugging)

- The cache is a flat `Map<hashKey(queryKey), {queryKey, data, staleAt, expiresAt}>`, in memory only.
    - Fresh (before `staleAt`): served with no request.
    - Stale (until `expiresAt`): shown immediately with `isFetching: true` while a background request
      revalidates it, on mount, focus or `refetch()`.
    - Expired (after `expiresAt` = `max(staleTime, cacheTime)`): dropped on read and by the sweep that
      runs before every cache write; the next mount starts blank. With both times 0 nothing is stored.
- `invalidateQueries` marks matching entries stale (it doesn't delete them), so an unmounted screen
  shows its old data on the next mount while it revalidates.
- Components on the same key share one in-flight request (`inflight` map). Invalidation drops
  matching in-flight requests, so a refetch after a mutation always sends a new request.
- A response is ignored by a component if it unmounted, its key changed, or a newer fetch started.
- Results are structurally shared: unchanged parts keep their previous object references, and an
  unchanged result keeps the same `data` reference, so `React.memo` rows and `data`-dependent
  effects only react to real changes.
- A key change reads that key's own cache entry. Without `keepPreviousData`, an uncached key starts
  with `data: undefined`.
- `onSuccess` fires only after a network fetch, not on a cache hit.
- App foreground and reconnect (only when `revalidateOnAppForeground` / `subscribeToNetwork` are
  set): on a background → active or offline → online transition, every query on screen (mounted,
  enabled, focused) whose data is stale or missing revalidates; fresh data is left alone. A query
  that failed while offline has no data, so it retries. Listeners are attached while at least one
  query is mounted.
- Focus (only when `useFocusEffect` is passed to `createAPI`):
    - on focus, a query revalidates only if its data is stale or gone; disabled queries are skipped
    - `invalidateQueries` refetches only focused queries; background screens keep their data, marked
      stale, and revalidate on their next focus
    - without the option, focus does nothing and every mounted, enabled match refetches on invalidation

## Not implemented yet

- Persistence across app restarts.
- Prefetching a key without mounting a `useQuery`.

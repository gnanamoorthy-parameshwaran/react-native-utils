# createAPI runtime: createAPI, useAPI, useQuery

Source, if behaviour needs checking: `node_modules/@gnanamoorthy/react-native-utils/src/packages/createAPI/client.ts` (all runtime logic) and
`node_modules/@gnanamoorthy/react-native-utils/src/packages/createAPI/types.ts` (exact shapes).

## Contents

- Setup
- `useAPI`
- `useQuery`
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

| Option                                                   | Purpose                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `baseURL`                                                | Prefixed to every `endpoint`                                                        |
| `onBeforeRequest({headers, emitEvent})`                  | Return `{headers}`; e.g. attach the auth token                                      |
| `onAfterResponse({response, retry, attempt, emitEvent})` | Return a `Response`; call `retry()` to resend, e.g. after refreshing a token on 401 |
| `maxRetries`                                             | Upper bound for `retry()` (default 1)                                               |
| `throwException`                                         | Throw typed `API*Error` classes on non-2xx instead of returning the body            |
| `onError({error, url, options, response, emitEvent})`    | Central error reporting; the error is rethrown afterwards                           |
| `queryTtl`                                               | Default `ttl` (ms) for queries that don't set one; 0 = no caching                   |
| `useFocusEffect`                                         | Optional focus hook, e.g. React Navigation's, for focus-aware queries               |

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
    ttl: 300_000, // ms served from cache before the next mount fetches
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

## `invalidateQueries`

```ts
await invalidateQueries(['things', {id}]); // one entry
await invalidateQueries(['things']); // every key starting with 'things'
await invalidateQueries(); // everything
```

Matching is by prefix, and object segments match partially: `['things', {userId: 1}]` also matches
`['things', {userId: 1, page: 2}]`. Matching cache entries and in-flight requests are dropped, then
matching queries that are mounted, enabled and focused refetch.

## Behaviour (for debugging)

- The cache is a flat `Map<hashKey(queryKey), {queryKey, data, expiresAt}>`, in memory only. An
  expired entry is dropped when read.
- Components on the same key share one in-flight request (`inflight` map). Invalidation drops
  matching in-flight requests, so a refetch after a mutation always sends a new request.
- A response is ignored by a component if it unmounted, its key changed, or a newer fetch started.
- A key change reads that key's own cache entry. Without `keepPreviousData`, an uncached key starts
  with `data: undefined`.
- `onSuccess` fires only after a network fetch, not on a cache hit.
- Focus (only when `useFocusEffect` is passed to `createAPI`):
    - on focus, a query fetches only if its cache has expired; disabled queries are skipped
    - `invalidateQueries` refetches only focused queries; background screens lose their cache entry
      and fetch on their next focus
    - without the option, focus does nothing and every mounted, enabled match refetches on invalidation

## Not implemented yet

- Infinite queries (append-as-you-scroll lists).
- Persistence across app restarts.
- Prefetching a key without mounting a `useQuery`.

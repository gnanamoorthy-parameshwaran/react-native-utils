# Why createAPI, useAPI, useQuery and generateAPI

## Server-state coverage at a glance

Managing server data well means solving the problems below. This is where `useQuery` stands today.

| Problem | Status | How |
|---|---|---|
| Caching | Covered | Results are cached in memory per `queryKey`. Within `staleTime` a remount renders instantly with no request; after that the cached data is still shown instantly while it revalidates. |
| Deduping multiple requests for the same data into a single request | Covered | Components on the same key share one in-flight request. |
| Updating "out of date" data in the background | Covered | Stale data stays on screen (`isFetching: true`) while a background request replaces it: on remount, on screen focus, after `invalidateQueries` and on `refetch()`. Data is only dropped after `cacheTime`, when the next mount starts blank. |
| Knowing when data is "out of date" | Covered | Data is fresh for `staleTime`, then stale. `invalidateQueries` marks matching data stale immediately. Stale data on screen revalidates when its screen regains focus (`useFocusEffect`), when the app returns to the foreground (`revalidateOnAppForeground`) and when the network comes back (`subscribeToNetwork`); the last two are opt-in. |
| Reflecting updates to data as quickly as possible | Partial | `invalidateQueries` refetches every visible query with a matching key at once. A single component's `refetch()` doesn't update other components showing the same key, and the cache can't be written directly (no `setQueryData` or optimistic updates). |
| Performance optimizations like pagination and lazy loading data | Covered | Page-number pagination with `keepPreviousData`, append-as-you-scroll lists with `useInfiniteQuery` (`fetchNextPage`, `hasNextPage`), and lazy loading with `enabled`. |
| Managing memory and garbage collection of server state | Covered | Data is kept for `cacheTime` (5 minutes by default) and every cache write first drops entries past it; results with both times at 0 are never stored. There is no separate cache-size cap. |
| Memoizing query results with structural sharing | Covered | Each new result is merged into the data already on screen: unchanged parts keep their previous object references, and a fully unchanged result keeps the same `data` reference. Memoized rows, `useMemo` and effects that depend on unchanged items skip work after a refetch. |

Most screens in our apps talk to the backend in the same way: a raw `fetch` call, a `useState` for
loading, a `try/catch`, and a manual check of `response.ok`. That works for one screen. Across a
whole app it means the same code repeated in every component, small differences in how each one
handles errors, and data fetched again and again because nothing is cached.

This package replaces that repetition with four pieces. Each one solves a specific set of
problems.

| Piece | What it is | Problems it removes |
|---|---|---|
| `createAPI` | One configured API instance for the app | Repeated base URLs, headers, auth, retry and error handling in every call |
| `useAPI` | A hook that sends requests through that instance | Hand-written loading state and `fetch` boilerplate in components |
| `useQuery` | A cached query hook for screens | Refetching the same data on every visit, duplicate requests, stale screens after updates |
| `generateAPI` | A CLI that generates typed client hooks from the OpenAPI spec | Hand-written endpoint strings and types drifting from the backend |

---

## `createAPI`: one place for every request's rules

`createAPI({...})` is called once per app. Every request in the app then goes through the same
pipeline.

```ts
const {useAPI, useQuery, useInfiniteQuery, invalidateQueries} = createAPI({
    baseURL: 'https://api.example.com',
    throwException: true,
    onBeforeRequest: async ({headers}) => {
        headers.set('Authorization', `Bearer ${await getToken()}`);
        return {headers};
    },
    onAfterResponse: async ({response, retry}) => (response.status === 401 ? (await refreshToken(), retry()) : response),
    onError: async ({error, url}) => reportError(error, url),
});
```

Problems it solves:

- **Base URL and headers repeated in every call.** With raw `fetch`, each call builds its own URL
  and sets its own `Accept`, `Content-Type` and `Authorization` headers. One missed header is a
  bug that only shows up on one screen. `onBeforeRequest` sets them once for every request.
- **Token refresh duplicated or missing.** Handling an expired token means checking for `401`,
  refreshing, and sending the request again, in every call that might hit it. `onAfterResponse`
  receives a `retry()` function, so this logic is written once. `maxRetries` stops it looping.
- **`fetch` doesn't fail on HTTP errors.** `fetch` only rejects on network failure; a `404` or
  `500` resolves normally, so every call must remember to check `response.ok`. With
  `throwException: true`, non-2xx responses throw typed errors instead: `APINotFoundError`,
  `APIUnauthorizedError`, `APIServerError` and the rest of the 4xx/5xx range (41 classes).
- **Validation errors parsed by hand.** A `422` throws `APIValidationError` with the backend's
  field errors attached, ready to show next to form fields.
- **Response parsing edge cases.** `response.json()` throws on `204 No Content`, empty bodies and
  non-JSON responses. The built-in parser handles all three, and `onBeforeResult` can replace it
  for special endpoints such as file downloads.
- **Error reporting scattered across screens.** `onError` sees every failed request with its URL
  and options, so logging and crash reporting live in one place.
- **App-wide reactions need plumbing.** Things like "log out when the session is invalid" need a
  request to talk to the rest of the app. Every hook receives `emitEvent`, which publishes to the
  handler given to `APIContextWrapper` at the app root.
- **No extra HTTP dependency.** All of this is built on the platform's own `fetch`.

## `useAPI`: requests from components without boilerplate

```ts
const {loading, request} = useAPI();

const save = () => request<Post>({method: 'PUT', endpoint: `/posts/${id}`, body: JSON.stringify(post)});
```

Problems it solves:

- **Loading state written by hand every time.** Each raw `fetch` call needs its own `useState`,
  a `setLoading(true)` before and a `setLoading(false)` in a `finally`. Forgetting the `finally`
  leaves a spinner stuck after an error. `useAPI` returns `loading` already managed.
- **Each component re-implements the request rules.** Components call `request()`, which runs
  the `createAPI` pipeline: headers, retry, typed errors and reporting come for free.
- **Untyped responses.** `request<T>()` returns a typed result instead of `any` from
  `response.json()`.
- **Per-request exceptions to the global rules.** A single call can still pass its own
  `headers`, `onBeforeRequest`, `onAfterResponse`, `onBeforeResult`, `maxRetries` or `signal`.

`useAPI` is the right tool for actions such as submitting a form or deleting a record.

## `useQuery`: cached data for screens

```ts
const {data, isLoading, isFetching, error, refetch} = useQuery({
    queryKey: ['posts', {page}],
    queryFn: ({request}) => request<Post[]>({endpoint: `/posts?page=${page}`}),
    staleTime: 60_000,
    keepPreviousData: true,
});

// after creating, editing or deleting a post
invalidateQueries(['posts']);
```

Problems it solves:

- **Every visit to a screen refetches the same data.** Without a cache, navigating back to a list
  shows a spinner and repeats a request whose answer hasn't changed. `useQuery` stores each result:
  within `staleTime`, returning renders instantly with no request; after that, the cached data still
  renders instantly while a background request refreshes it, so the user never waits on a blank
  screen for data they've already seen. That means faster screens, less mobile data and battery,
  and less load on the backend.
- **The same data requested twice at once.** When a header and a list on one screen both need the
  same data, raw `fetch` sends two identical requests. Components using the same `queryKey` share
  one request.
- **Screens showing stale data after an update.** After a post is edited, every screen showing
  posts has to be told to reload, which usually means passing callbacks or refresh flags between
  screens. `invalidateQueries(['posts'])` marks every cached entry whose key starts with
  `['posts']` (every page, every filter, every single post) as stale and refetches the ones on
  screen; the others show their old data and refresh when next opened.
- **Background screens refetching for nobody.** When the app's `useFocusEffect` is passed to
  `createAPI`, invalidation refetches only the screen in view. Screens further back in the
  navigation stack load fresh data when the user returns to them, and a screen regaining focus
  revalidates if its data is stale.
- **Screens left out of date after the app was in the background or offline.** With
  `revalidateOnAppForeground` and `subscribeToNetwork`, the queries on screen revalidate when the
  app comes back to the foreground or the connection returns, and requests that failed while
  offline are retried, without a pull-to-refresh.
- **Out-of-order responses.** If the user changes page or filter quickly, an older response can
  arrive after a newer one and overwrite it. `useQuery` ignores a response that no longer matches
  the key on screen.
- **Lists flashing empty while paging.** With `keepPreviousData`, the current page stays on screen
  (with `isPlaceholderData: true`) until the next page arrives.
- **One spinner for every situation.** `isLoading` is true only when there is nothing to show yet;
  `isFetching` is true for any request, including background refetches. Screens can show a
  full-screen loader for the first load and a small indicator for refreshes.
- **Every refetch re-rendering every row.** A fresh JSON response is all new objects, so memoized
  list rows re-render even when their item didn't change. `useQuery` reuses the previous objects
  for every unchanged part of the result (structural sharing), so only rows whose data changed
  re-render.
- **Hand-built "load more" lists.** Appending pages by hand means tracking the page number, a
  "has more" flag, a loading-more flag and guarding against duplicate loads from `onEndReached`.
  `useInfiniteQuery` does all of it and caches the whole list as one entry, so it is shown instantly
  when the user comes back.
- **Lazy and conditional loading.** `enabled: false` holds a query until its inputs are ready,
  for example until a selected item exists.

## `generateAPI`: typed clients generated from the backend's spec

```sh
npx @gnanamoorthy/react-native-utils generate-client --config ./client-generator.config.json
```

The generator reads the backend's OpenAPI spec and writes one hook per resource, plus TypeScript
types for every request and response:

```ts
const {gettingInvoices, getInvoices, postingInvoice, createInvoice} = useInvoice({businessUnit});

const invoices = await getInvoices({params: {page: 2}}); // typed as GetInvoicesResponse
```

Problems it solves:

- **Endpoint URLs typed by hand.** A typo in `/business-units/${id}/invocies` compiles fine and
  fails at runtime. Generated methods build the URL from the spec.
- **Request and response types written by hand, then drifting.** Hand-written interfaces fall out
  of date as soon as the backend changes a field. Regenerating after a backend change updates
  every type, and TypeScript then flags each call site that no longer matches before the app ships.
- **Missing or wrong parameters.** Path parameters, query parameters and request bodies are typed
  per endpoint, and required ones are required.
- **The same boilerplate for every endpoint.** Each generated method already has its own loading
  flag (`gettingInvoices`, `postingInvoice`), its `useCallback`, JSON body encoding and headers.
- **No documentation at the call site.** Summaries, descriptions and parameter docs from the spec
  become JSDoc, so they show up in editor hover and autocomplete.
- **Inconsistent naming across the team.** Hooks, methods and loading flags follow one naming
  scheme derived from the spec, so every project reads the same way.
- **One output shape doesn't fit every project.** `framework` can point to a custom generator
  module that reuses the parsed spec but writes a different structure. `formatCommand` runs the
  project's formatter on the output.

Generated clients are plain API clients built on `useAPI`. Caching stays a screen-level decision:
a screen wraps a generated method in `useQuery` with the key and stale time it needs.

```ts
const {getInvoices} = useInvoice({businessUnit});

const {data} = useQuery({
    queryKey: ['invoices', {businessUnit, page}],
    queryFn: () => getInvoices({params: {page}}),
    keepPreviousData: true,
});
```

---

## How the pieces fit together

```
generateAPI  ->  typed client hooks (useInvoice, useContact, ...)
                      |
useQuery     ->  caching, sharing, invalidation for screens
                      |
useAPI       ->  request() + loading for components
                      |
createAPI    ->  one pipeline: base URL, headers, auth, retry, errors, reporting
                      |
                    fetch
```

Each layer is usable on its own. A project can start with `createAPI` and `useAPI` alone and add
the others when it needs them.

## Adopting it gradually

1. **Create the instance.** Add one `createAPI` file with the base URL, auth header and error
   reporting. Wrap the app in `APIContextWrapper`.
2. **Replace raw `fetch` calls with `useAPI`.** Each replacement deletes its own loading state,
   `response.ok` check and header setup.
3. **Wrap read-heavy screens in `useQuery`.** Start with lists and detail screens users revisit
   often, and call `invalidateQueries` after the mutations that affect them.
4. **Generate clients from the spec.** Replace hand-written endpoint calls and types with
   generated hooks, and regenerate whenever the backend changes.

## Current scope

To set expectations accurately:

- The query cache lives in memory; it does not persist across app restarts.
- `useInfiniteQuery` loads forward only, keeps every loaded page (no page limit), and reloads only
  the first page on refresh.
- The generator emits React hooks; other output shapes need a custom generator module.

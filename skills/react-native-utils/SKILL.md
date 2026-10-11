---
name: react-native-utils
description: Use @gnanamoorthy/react-native-utils' API layer in a React Native app -- setting up createAPI, sending requests with useAPI, caching and paginating screen data with useQuery, invalidating with invalidateQueries, and generating typed API client hooks from an OpenAPI spec with `generate-client`. Use whenever the task involves calling the backend, fetching or caching data on a screen, refreshing data after a mutation, or generating/regenerating API clients in a project that depends on @gnanamoorthy/react-native-utils.
---

# @gnanamoorthy/react-native-utils: API layer

The package provides:

- **`createAPI`**: called once per app. Returns `{ useAPI, useQuery, useInfiniteQuery, invalidateQueries }`.
    - `useAPI()` → `{ loading, request }`: the request layer. Base URL, headers, auth, retry and
      typed errors are configured once in `createAPI`. No caching.
    - `useQuery` → a screen-level hook. Each screen picks its own `queryKey` and `staleTime`; results are
      cached in memory and cleared by key prefix with `invalidateQueries`.
    - `useInfiniteQuery` → the same for append-as-you-scroll lists: `fetchNextPage` appends pages,
      and the whole list is one cache entry.
- **`generate-client`** (CLI): reads the backend's OpenAPI spec and generates typed
  `use{Resource}()` client hooks built on `useAPI`. It generates **API clients only**; caching is
  always added on the screen with `useQuery`.

## Which file to read

Read only what the task needs:

| Task                                                               | Read                                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Set up `createAPI` in the app, or change its options               | [references/runtime.md](references/runtime.md), [examples/create-api-setup.ts](examples/create-api-setup.ts)                    |
| Fetch, cache, paginate or invalidate data on a screen              | [references/runtime.md](references/runtime.md), [examples/paged-query.tsx](examples/paged-query.tsx)                            |
| Load a list page by page as it scrolls (`FlatList` `onEndReached`) | [references/runtime.md](references/runtime.md) ("`useInfiniteQuery`"), [examples/infinite-list.tsx](examples/infinite-list.tsx) |
| Debug caching, refetching or loading flags                         | [references/runtime.md](references/runtime.md) ("Behaviour")                                                                    |
| Configure or run the generator, or read its output                 | [references/generator.md](references/generator.md)                                                                              |
| Cache a generated client method on a screen                        | [examples/generated-client-query.tsx](examples/generated-client-query.tsx)                                                      |

## Rules that apply to every task

- Find the project's `createAPI` instance first (usually `src/hooks/useAPI.ts`; search for
  `createAPI(`). Import `useAPI`, `useQuery`, `useInfiniteQuery` and `invalidateQueries` from it, never from the
  package directly, and never call `createAPI` a second time.
- Check the exact option and result shapes in
  `node_modules/@gnanamoorthy/react-native-utils/src/packages/createAPI/types.ts` before writing a
  call. Don't guess field names.
- Use `useAPI().request` (or a generated client method) for mutations and one-off calls; use
  `useQuery` for data a screen reads. After a mutation, call `invalidateQueries` with the affected
  key prefix.
- Prefer generated client hooks over hand-written `request()` calls when the project has them.
  Don't hand-edit generated files; regenerate them instead.

This skill was installed by `npx @gnanamoorthy/react-native-utils add-skill`. Re-run that command
after upgrading the package rather than editing these files, so the instructions match the
installed version.

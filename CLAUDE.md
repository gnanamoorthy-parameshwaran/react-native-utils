# CLAUDE.md

Decisions for working on `@gnanamoorthy/react-native-utils`. Follow these unless the user says otherwise,
and update this file when a decision changes.

## Code style

- **Multiline doc comments, not per-line comments.** Write one short `/** ... */` block above a class,
  function or non-obvious section explaining the *why*. Don't add a `//` comment on every line; leave
  self-explanatory code uncommented.
- **Object parameters.** A function with two or more parameters takes one destructured object
  (`writeCache({hash, queryKey, data, ttl})`), not positional arguments. One parameter can stay positional.
- **generateAPI follows a Laravel-style layout:** one small class per concern in `parsers/`,
  `resolvers/`, `generators/`, `support/`, `contracts/`, `types/`. A new output framework is one driver
  class plus one case in `GeneratorManager`.
- **The createAPI runtime stays in one file for now.** `src/packages/createAPI/client.ts` holds the
  request pipeline, `useAPI`, `useQuery` and `invalidateQueries` as plain closures, so it reads top to
  bottom. Don't split it into classes, observers or a hooks folder until the user asks to.

## Commits

- Conventional commits (enforced by commitlint), grouped by topic, one concern per commit.
- No `Co-Authored-By` trailer.
- Work on a feature branch, not `main`; push only when asked.
- The pre-commit hook runs `eslint` on staged files and `tsc` on the whole project. Gitignored leftovers
  under `example/src/generated/` can break `tsc`; check them before assuming the change is at fault.

## API layer: roles

- **`useAPI`** is the request layer and always exists: base URL, headers, auth, retry, typed errors and
  error reporting, configured once in `createAPI`. It returns `{loading, request}` and never caches.
- **`useQuery`** is a page-level composable. Each screen picks its own `queryKey` and `ttl`.
- **`generateAPI`** emits typed API clients only (`use{Resource}()` hooks on top of `useAPI`). It never
  emits query hooks, cache options or invalidate helpers; an `x-cache-config` spec extension is ignored.
  Caching a generated method is done on the screen by calling it inside `useQuery`.
- `createAPI()` returns `{useAPI, useQuery, invalidateQueries}`. There is no `queryClient` object.

## useQuery: decisions

| Topic | Decision |
|---|---|
| Cache structure | Flat `Map<hashKey(queryKey), {queryKey, data, expiresAt}>`, not a nested tree. |
| Freshness | Simple TTL: data is served from cache until it expires, then the next mount or focus fetches. No stale-while-revalidate. |
| Invalidation | `invalidateQueries(queryKey)` matches by key prefix, with partial matching on object segments. No tags. |
| Deduplication | Same-key fetches share one in-flight request. Invalidation drops matching in-flight requests so a refetch never reuses a request from before it. |
| Persistence | In memory only. Cache drivers (Memory, AsyncStorage, Tagged) were removed; a persistence driver may come later. |
| Screen focus | Navigation hooks are injected: `createAPI({useFocusEffect})`. The library never imports a navigation package. On focus a query fetches only if expired; invalidation refetches only focused queries, and background screens fetch when they regain focus. |
| Pagination | `keepPreviousData` keeps the previous key's data as placeholder. `isLoading` = nothing to show yet, `isFetching` = any request in flight, `isPlaceholderData` = showing the previous key's data. |
| Memory | Every cache write first drops expired entries; results with `ttl` 0 are never stored. |
| Structural sharing | Each result is merged into the data on screen (and into the existing cache entry) with `replaceEqualDeep`; unchanged parts keep their references. |

## generateAPI output

- Generated React output must stay **byte-stable**: files a change isn't meant to touch must come out
  identical. Verify with the local spec (`node example/scripts/serve-openapi.js`), a rebuilt CLI
  (`npm run build:cli`) and before/after generation into scratch directories.
- Full requirements: `docs/requirement.md`. Keep its §3.7 "Known scope limits" in sync.

## Skills and docs

- `skills/react-native-utils/` is the AI skill shipped to package users and installed with
  `npx @gnanamoorthy/react-native-utils add-skill`. It is the single source of truth for how the API
  layer is used. Update it in the same change as any API change; its paths must work inside a user's
  project (`node_modules/...` or the GitHub repo). Its examples are typechecked by the project's `tsc`.
- `.claude/skills/react-native-utils-api/` is the maintainer skill for this repository.
- `docs/api-layer.md` explains what each piece solves and has a server-state coverage table; keep the
  table's statuses accurate when features change.
- In user-facing docs, compare the package against plain `fetch` only. Don't name other HTTP libraries
  or explain why they aren't used, and don't attribute authorship.

## Planned, not done yet

- `useInfiniteQuery` (append-as-you-scroll lists), built on the same cache.
- A persistence driver.
- A cache size cap (LRU) if many keys are created within one TTL.
- Separate stale time, refetch on reconnect, `setQueryData` / optimistic updates.

---
name: react-native-utils-api
description: Set up and use @gnanamoorthy/react-native-utils' createAPI runtime and generateAPI code generator in a React Native app -- wiring createAPI/useAPI, running `generate-client` against an OpenAPI spec to produce typed hooks, configuring x-cache-config caching plus tag-based group invalidation, and writing custom generator drivers. Use whenever the user asks to set up API calls in a React Native app using this package, generate a typed API client from an OpenAPI/Scramble spec, add or debug caching/cache invalidation on a useAPI() call, or extend/customize generateAPI's output.
---

# react-native-utils: createAPI + generateAPI

Two packages that work together, not two unrelated tools:

- **`createAPI`** (`src/packages/createAPI`) — the runtime. A factory that returns a `useAPI()`
  hook: `{ loading, request, invalidateCache, invalidateCacheGroup }`. Ships in the RN/web bundle.
- **`generateAPI`** (`src/packages/generateAPI`) — a Node-only CLI/codegen tool that reads a
  project's OpenAPI spec and **emits React hooks that call `useAPI()` for you**, so nobody
  hand-writes `useProduct()`/`useContact()` against raw `request()` calls. Never bundled into the
  app; runs at dev time via `npx @gnanamoorthy/react-native-utils generate-client`.

The full authoritative spec for generateAPI's behavior (naming rules, output layout, every config
field) lives in [docs/requirement.md](../../../docs/requirement.md) — read it before changing
generator internals. This skill covers the parts an agent needs to *use* the two packages
correctly; don't restate exact type shapes from memory here when the source files below are one
Read away and will always be current.

## 1. Setting up the createAPI runtime

One `createAPI({...})` call per app, producing one `useAPI` hook re-exported from a project file
(convention: `src/hooks/useAPI.ts` — see `example/src/hooks/useAPI.ts` for a real instance):

```ts
import {createAPI, MemoryCacheDriver} from '@gnanamoorthy/react-native-utils';

const useAPI = createAPI({
    baseURL: 'https://api.example.com',
    cache: new MemoryCacheDriver(), // optional, this is the default
    throwException: true,           // optional: throw typed APIxxxError on non-2xx instead of returning the body
    maxRetries: 1,                  // optional
    onBeforeRequest: async ({headers, emitEvent}) => ({headers}), // e.g. attach an auth token
    onAfterResponse: async ({response, retry, attempt}) => response, // e.g. refresh-token-and-retry on 401
    onError: async ({error, url, options, response, emitEvent}) => {},
});

export default useAPI;
```

- Check `src/packages/createAPI/types.ts` for the exact `CreateAPIProps`/`FetchProps` shape before
  writing a call — don't guess field names.
- Only `MemoryCacheDriver` is exported from the package root today
  (`src/packages/createAPI/index.ts`); `AsyncStorageCacheDriver` (persistent RN cache) exists at
  `src/packages/createAPI/drivers/AsyncStorageCacheDriver.ts` but isn't re-exported, so reaching it
  needs a deep import or the export list needs updating first — flag this to the user rather than
  assuming it's importable.
- Every driver passed as `cache` is wrapped internally in `TaggedCacheDriver`
  (`src/packages/createAPI/drivers/TaggedCacheDriver.ts`) automatically — this is what makes
  `invalidateCacheGroup` work regardless of which driver you pass. You never construct
  `TaggedCacheDriver` yourself.
- Wrap the app in `APIContextWrapper` (from the same package) so `useAPI()`'s `emitEvent` has
  something to publish to.

### Calling the runtime directly (when there's no generated hook yet)

```ts
const {loading, request, invalidateCache, invalidateCacheGroup} = useAPI();

// Uncached GET
const data = await request<MyResponseType>({method: 'GET', endpoint: '/v1/things'});

// Cached GET, tagged for group invalidation
const data = await request<MyResponseType>({
    method: 'GET',
    endpoint: '/v1/things',
    cacheConfig: {ttl: 300000, tags: ['things']}, // key omitted -> derived via getCacheKey({method, endpoint})
});

// After a mutation elsewhere, clear every cached variant tagged "things"
// (every page/filter combination, not just one exact key):
await invalidateCacheGroup('things');

// Or clear one exact cached entry by its key:
await invalidateCache(getCacheKey({method: 'GET', endpoint: '/v1/things'}));
```

Prefer generating hooks with `generateAPI` over hand-writing this — see below.

## 2. Generating typed hooks with generateAPI

### 2.1 Config file (`client-generator.config.json`)

```json
{
    "specUrl": "http://localhost:4879/spec.json",
    "useAPIImportPath": "../../../../hooks/useAPI",
    "clientOutputDir": "src/generated/clients",
    "typeOutputDir": "src/generated/types",
    "formatCommand": "npx prettier --write"
}
```

Required: `specUrl`, `useAPIImportPath`, `clientOutputDir`, `typeOutputDir`. Optional:
`formatCommand`, `framework` (§2.4). Full field docs: `src/packages/generateAPI/types/Config.ts`
and docs/requirement.md §3.2.

### 2.2 Running it

```sh
npx @gnanamoorthy/react-native-utils generate-client --config ./client-generator.config.json
```

Resolves `client-generator.config.json` from the cwd by default, or `--config <path>`. Fetches
`specUrl` with a plain unauthenticated GET, downloads it to a temp file, parses it, writes output,
then runs `formatCommand` (if set) against both output dirs.

**Local iteration without a live backend**: `example/scripts/serve-openapi.js` serves a static
spec fixture over HTTP so `specUrl` can point at `http://localhost:4879/spec.json` — useful when
verifying a generator change before a real backend is reachable. Point a *scratch* config file at
a copy of the spec + a throwaway output dir when testing changes to the generator itself, so you
never overwrite real generated output while experimenting.

### 2.3 What comes out

One `use{Resource}.ts` hook file per `(version, folder, resource)` group, one type file per
resource group. A generated method:

```ts
const getExpenses = React.useCallback(() => {
    return getExpensesRequest<GetExpensesResponse>({
        method: 'GET',
        endpoint: `/v1/business-units/${businessUnit}/expenses`,
        cacheConfig: {ttl: 300000, key: getCacheKey({method: 'GET', endpoint: `...`})},
    });
}, [getExpensesRequest, businessUnit]);
```

Naming, object-param convention, parent-vs-own path param placement, and every other output rule:
docs/requirement.md §2.5. Don't hand-edit generated files — they're regenerated wholesale and
marked "do not edit by hand" in their own header comment; change the spec or the generator instead.

### 2.4 Caching + group invalidation from the spec side

Caching is driven entirely by an `x-cache-config` vendor extension on a GET operation in the
OpenAPI spec (e.g. added via a Scramble PHP attribute/annotation on the backend, not hand-edited
into the generated spec.json):

```json
"x-cache-config": {"ttl": 300000, "tags": ["business-units"]}
```

- `ttl` — milliseconds.
- `tags` — optional. Put the **same** tag on a resource's list GET and its detail GET(s) so one
  `invalidate{Tag}Group()` helper (deduplicated per file, emitted once even if several operations
  share the tag) clears every cached variant of both at once after a mutation.
- Query params (pagination, filters) are supported and cache correctly — each distinct params
  combination gets its own key via `getCacheKey({method, endpoint, query})`
  (`src/packages/createAPI/util.ts`), so `?page=1` and `?page=2` never collide.
- Without `tags`, a cached GET still gets a per-operation `invalidate{Resource}()` helper that
  clears only the one exact key matching the params it's called with — not useful for clearing
  every page of a paginated list at once, which is exactly what `tags` is for.

Resolver: `src/packages/generateAPI/resolvers/CacheResolver.ts`. Emission (cache key construction,
tag-group helper generation): `src/packages/generateAPI/generators/frameworks/ReactClientGenerator.ts`.

### 2.5 Custom output (skip the built-in React hooks)

`framework` in the config can point to a JS module instead of `"react"` — full contract and a
working example (`example/codegen/flat-functions-generator.js`) in docs/requirement.md §2.7. Use
this when a project wants a different output shape (e.g. flat fetch functions, a different
framework) but still wants the spec parsed the same way.

## 3. Before changing generator internals

1. Read docs/requirement.md in full — it's the requirements record, not just a README, and
   documents *why* things are shaped the way they are (e.g. why there's no shared response
   wrapper type, why cache keys fold in the query string).
2. Rebuild the CLI after any change under `src/packages/generateAPI/`: `npm run build:cli`
   (`example`'s `generate:api` script runs the **compiled** `lib/cli`, not the TS source).
3. Regenerate against the local spec fixture and read the diff before trusting a change —
   `npx tsc --noEmit` catches type errors in the generator itself, not malformed *generated*
   output; only an actual generation run against a real spec proves the emitted code is right.
4. `docs/requirement.md` §3.7 ("Known scope limits") must be kept in sync — if a fix closes one of
   those limits (as the pagination-caching fix did), update that section in the same change.

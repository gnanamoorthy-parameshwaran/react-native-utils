---
name: react-native-utils-api
description: Set up and use @gnanamoorthy/react-native-utils' createAPI runtime and generateAPI code generator in a React Native app -- wiring createAPI/useAPI/useQuery, running `generate-client` against an OpenAPI spec to produce typed API client hooks, composing page-level caching with useQuery, and writing custom generator drivers. Use whenever the user asks to set up API calls in a React Native app using this package, generate a typed API client from an OpenAPI/Scramble spec, add or debug caching/cache invalidation with useQuery/invalidateQueries, or extend/customize generateAPI's output.
---

# react-native-utils: createAPI + generateAPI

Two packages that work together, not two unrelated tools:

- **`createAPI`** (`src/packages/createAPI`) — the runtime. A factory returning
  `{ useAPI, useQuery, invalidateQueries }`. `useAPI()` is `{ loading, request }` with no caching;
  `useQuery` caches results per query key with a TTL. Ships in the RN/web bundle.
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

One `createAPI({...})` call per app, re-exported from a project file (convention:
`src/hooks/useAPI.ts`; see `example/src/hooks/useAPI.ts`). The generator's `useAPIImportPath`
points at this file and only needs `useAPI` as its **default** export. `useQuery` and
`invalidateQueries` are named exports for pages to use:

```ts
import {createAPI} from '@gnanamoorthy/react-native-utils';

const {useAPI, useQuery, invalidateQueries} = createAPI({
    baseURL: 'https://api.example.com',
    queryTtl: 60_000,               // optional: default ttl (ms) for queries that don't set one; 0 if omitted
    throwException: true,           // optional: throw typed APIxxxError on non-2xx instead of returning the body
    maxRetries: 1,                  // optional
    onBeforeRequest: async ({headers, emitEvent}) => ({headers}), // e.g. attach an auth token
    onAfterResponse: async ({response, retry, attempt}) => response, // e.g. refresh-token-and-retry on 401
    onError: async ({error, url, options, response, emitEvent}) => {},
});

export {useQuery, invalidateQueries};
export default useAPI;
```

- Check `src/packages/createAPI/types.ts` for the exact option/result shapes (`UseQueryOptions`,
  `UseQueryResult`, `FetchProps`) before writing a call. Don't guess field names.
- The query cache is in memory only. There is no persistence driver yet, so cached data doesn't
  survive an app restart.
- Wrap the app in `APIContextWrapper` so `emitEvent` has something to publish to.

### Querying without a generated hook

```ts
// Plain request (mutations, one-offs): no cache
const {loading, request} = useAPI();
await request<Thing>({method: 'POST', endpoint: '/v1/things', body: JSON.stringify(input)});

// Cached query: `request` in queryFn is useAPI's request without the loading state
const {data, error, isLoading, refetch} = useQuery({
    queryKey: ['things', {page}],          // serializable array; object key order doesn't matter
    queryFn: ({request}) => request<Thing[]>({endpoint: `/v1/things?page=${page}`}),
    ttl: 300_000,                          // served from cache until expiry, then the next mount fetches
    enabled: !!userId,                     // lazy: don't fetch until true
    onSuccess: data => {},
    onError: error => {},
});

// After a mutation: clears by key prefix; mounted matching queries refetch immediately
await invalidateQueries(['things']);
```

Behaviour that matters when debugging (all in `src/packages/createAPI/client.ts`):

- The cache is a flat `Map<hashKey(queryKey), {queryKey, data, expiresAt}>`, in memory only.
- Components on the same key share one in-flight request (`inflight` map). `invalidateQueries` drops
  matching in-flight requests, so a refetch after a mutation always sends a new request.
- `refetch()` and invalidation always hit the network; a key change reads that key's own cache entry.
- Pagination helpers and infinite queries are not implemented yet.

Roles: `useAPI` is the axios-like request layer, managed in one place. `useQuery` is a
page-level composable where each screen picks its own keys and TTL. Prefer generating the
API clients with `generateAPI` over hand-writing `request()` calls; see below.

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
resource group. Each `use{Resource}()` hook holds plain typed `request` methods with per-method
loading flags. The generator emits **API clients only**: no query hooks, invalidate helpers or cache
options. The full sample is in docs/requirement.md §3.6.

Naming, object-param convention, parent-vs-own path param placement, and every other output rule:
docs/requirement.md §2.5. Don't hand-edit generated files — they're regenerated wholesale and
marked "do not edit by hand" in their own header comment; change the spec or the generator instead.

### 2.4 Caching a generated client at page level

Compose a generated method inside `useQuery` on the screen that needs it, with
keys the screen chooses:

```ts
const {getInvoices} = useInvoice({businessUnit});

const {data} = useQuery({
    queryKey: ['invoices', {businessUnit, page}],
    queryFn: () => getInvoices({params: {page}}),
    ttl: 300_000,
});

// After a mutation: every cached invoices page, by key prefix
await invalidateQueries(['invoices']);
```

An `x-cache-config` vendor extension in the spec is ignored by the generator.

### 2.5 Custom output (skip the built-in React hooks)

`framework` in the config can point to a JS module instead of `"react"` — full contract and a
working example (`example/codegen/flat-functions-generator.js`) in docs/requirement.md §2.7. Use
this when a project wants a different output shape (e.g. flat fetch functions, a different
framework) but still wants the spec parsed the same way.

## 3. Before changing generator internals

1. Read docs/requirement.md in full — it's the requirements record, not just a README, and
   documents *why* things are shaped the way they are (e.g. why there's no shared response
   wrapper type, why query keys include the query params).
2. Rebuild the CLI after any change under `src/packages/generateAPI/`: `npm run build:cli`
   (`example`'s `generate:api` script runs the **compiled** `lib/cli`, not the TS source).
3. Regenerate against the local spec fixture and read the diff before trusting a change —
   `npx tsc --noEmit` catches type errors in the generator itself, not malformed *generated*
   output; only an actual generation run against a real spec proves the emitted code is right.
4. `docs/requirement.md` §3.7 ("Known scope limits") must be kept in sync — if a fix closes one of
   those limits (as the pagination-caching fix did), update that section in the same change.

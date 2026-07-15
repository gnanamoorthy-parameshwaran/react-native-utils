# OpenAPI Client Generator — Requirements & Implementation

`@gnanamoorthy/react-native-utils` ships a code generator (`generateAPI`) that reads an
OpenAPI spec (produced by a Laravel backend via dedoc/Scramble) and generates TypeScript types
and React hooks that call the API through this package's own `createAPI`/`useAPI` runtime. This
document records the requirements gathered while building it and the shape of the current
implementation.

## 1. Background

- The package already ships `createAPI` (`src/packages/createAPI`): a factory,
  `createAPI({ baseURL, cache, throwException, onBeforeRequest, onAfterResponse })`, whose
  returned hook (`useAPI()`) exposes exactly `{ loading, request, invalidateCache }` — one
  generic `request<T>(options)` and one `loading` flag per hook call. This replaced an older
  `useAPI` shape (`Get/Post/Put/Patch/Delete` methods plus one loading flag per verb).
- `generateAPI` exists to stop hand-writing hooks like `useProduct()`/`useContact()` against
  `useAPI()` by hand, and instead generate them from the backend's own OpenAPI spec, keeping
  request/response types and endpoint wiring in sync with the API automatically.

## 2. Requirements

### 2.1 Target `useAPI` shape

- Generated code must call the **new** `useAPI()` shape (`{ loading, request, invalidateCache }`),
  not the old per-verb one.
- Each generated method calls `useAPI()` **itself** (isolated loading per method) rather than
  sharing one `useAPI()` call across a whole file.

### 2.2 Configuration

- Config is a JSON file, `client-generator.config.json`, resolved from the current working
  directory by default or via `--config <path>`.
- Required fields: `specUrl`, `useAPIImportPath`, `clientOutputDir`, `typeOutputDir`.
- Optional: `formatCommand`, `framework` — either a built-in driver name (`"react"`, the default
  and only one shipped so far) or a path to a custom generator module (§2.7).
- `specUrl` is fetched with a plain `GET`, no authentication.
- The fetched spec is downloaded to a temp file (`os.tmpdir()`) before being parsed, and the
  temp file is deleted after generation (success or failure).

### 2.3 CLI / packaging

- Package renamed to `@gnanamoorthy/react-native-utils` so it can be run as
  `npx @gnanamoorthy/react-native-utils generate-client --config <path>`.
- The CLI is a subcommand router (`generate-client` is the only subcommand today) so more can be
  added later without a breaking change.
- The CLI is Node-only (uses `fs`/`path`/`os`/`child_process`) and is built separately from the
  React Native library build:
    - `tsconfig.cli.json` compiles `src/packages/generateAPI/**` to CommonJS under `lib/cli`.
    - `generateAPI` is excluded from the RN-facing `bob` build (`module`/`typescript` targets)
      so Node-only code doesn't get bundled into the RN/web-facing `lib/module` output.
- Unused packaging leftovers from the original `create-react-native-library` scaffold (`android`,
  `ios`, `cpp`, `*.podspec`, `react-native.config.js` references, none of which exist in this
  repo) were removed from `package.json`'s `files` field before publishing.

### 2.4 Type generation

- Component schemas are grouped by resource: qualifiers (`Base`, `Create`, `Update`, `Delete`,
  `Store`, `My` as prefixes; `Resource`, `Request`, `Response`, `List`, `Detail` as suffixes) are
  stripped to find the shared name behind a family of schemas — e.g. `BaseContactResource` and
  `UpdateContactRequest` both belong to the `Contact` group and are written to one file.
- One TypeScript file per resource group, containing the original schema types **and** synthesized
  request/response types for that resource's operations.
- Every operation gets a generated `{Method}Response` type, expressed as
  `ResponseSuccessType<T>`, where `T` is the unwrapped `data` payload of the response envelope
  (or the raw schema if there's no `{ data: ... }` envelope, or `null` for a no-content response).
- `ResponseSuccessType<T> = { data: T }` is a single shared type, written once.

### 2.5 Client (hook) generation

- One React hook file per `(version, folder, resource)` group.
- **Method naming**: prefers the OpenAPI `operationId`'s `Version.Folder.File.method` convention
  (used by this backend's Scramble setup) when present; falls back to `tags` + the URL path for
  operationIds that don't follow it, or that only give a generic Laravel action word (`index`,
  `store`, `show`, `update`, `destroy`, `create`) with no resource context. The fallback
  synthesizes canonical names: `get{Resource}s` (collection GET), `get{Resource}` (item GET),
  `create{Resource}` (POST), `update{Resource}` (PUT/PATCH), `delete{Resource}` (DELETE).
- **Loading flag naming**: verb-gerund + the part of the method name that disambiguates it, e.g.
  `getAddress` → `gettingAddress`, `updateAddress` → `patchingAddress`. Strips the leading verb
  the same way for the cache-invalidate method name (§2.6), so it reads as `invalidateProducts`/
  `invalidateProduct`, not `invalidateGetProducts`.
- All of a file's `useAPI()` calls (and their loading/request/invalidate destructures) are
  grouped together immediately after the function opens, **not** interleaved with each method's
  `React.useCallback` block.
- **Object-props calling convention**: both the hook and every method take a single destructured
  object argument, never positional params, so new fields can be added later without breaking
  call sites. Path params are split by scope: a **parent** resource's id (e.g. `businessUnit` in
  `/business-units/{businessUnit}/expenses`) is passed to the **hook**
  (`useExpense({ businessUnit })`); this resource's **own** id — the URI's trailing path param,
  if any (e.g. `expense` in `/expenses/{expense}`) — is passed to the **method**
  (`getExpense({ expense })`) instead. A hook-level prop is required only if every operation in
  that file needs it, else optional. If a path param is method-level in any operation of a file
  (e.g. a sub-action route like `/employees/{employee}/avatar`, which doesn't end in a param but
  shares a file with `/employees/{employee}`), it's promoted to method-level everywhere in that
  file to avoid the hook and a method both binding a same-named but different variable. A
  method/hook with no inputs at all keeps taking no argument, rather than a forced empty object.
- Nested routes (e.g. a `BusinessUnit`'s `Contact` sub-resource) are kept in a separate
  `folder` subdirectory from an unrelated top-level resource of the same name, so
  `V1.BusinessUnit.Contact.getContacts` and `V1.Contact.Contact.getContact` don't collide into
  the same generated file.
- Generated code is passed through the user's own formatter (see §2.8) rather than the
  generator's own fixed 4-space style, so output matches the consuming project's conventions
  (indent width, quotes, line length, etc.) automatically.

### 2.6 Caching

- Per-endpoint cache behavior is read from an `x-cache-config` OpenAPI vendor extension on the
  operation, e.g. `{ "ttl": 300 }` (seconds).
- Only applies to `GET` operations with no query parameters — caching a paginated/query-filtered
  endpoint is intentionally out of scope for now.
- When present, the generated method's `request()` call gets a `cacheConfig: { ttl, key }`
  (key computed via `createAPI`'s exported `getCacheKey({ method, endpoint })`), and a companion
  `invalidate{Resource}` method is generated next to it, taking the same path params and
  recomputing the identical cache key to call `invalidateCache`.

### 2.7 Custom generators (user-defined output structure)

- Users can define their **own** structure for the generated code instead of the built-in React
  hooks: the generator provides the parsed method names/params/types (the `ParsedAPI` IR), and a
  user-authored module decides what files to write.
- Selected via the same `framework` config field: anything containing a path separator (or ending
  in `.js`/`.cjs`/`.mjs`) is treated as a module path, resolved **relative to the config file**;
  a bare name selects a built-in driver.
- The module (CommonJS or ESM — loaded via dynamic `import()`) must export a factory, as its
  default export or the whole `module.exports`:
  `(context) => ({ generate() { return files; } })`, where `files` is
  `{ directory, name, content }[]` with `directory` relative to the config file's folder.
- `context` carries everything needed (see `contracts/FrameworkGenerator.ts`):
    - `parsed` — the framework-neutral IR (`info`, `operations`, `schemas`, `schemaGroups`);
    - `config` — the resolved generator config;
    - `support` — reusable built-in pipeline pieces, so a custom generator only rewrites what it
      wants to change: `groupOperations` (version/folder/resource grouping),
      `reconcilePathParams` (hook-vs-method param promotion, §2.5), `generateTypeFiles` (the
      built-in framework-neutral type files), `stringUtil`, `docUtil`.
- A custom generator owns **all** output — it can keep the built-in type files by spreading
  `support.generateTypeFiles()` into its result, or replace them entirely.
- A working example lives at `example/codegen/flat-functions-generator.js` (flat framework-free
  `fetch` functions, one file per resource).

### 2.8 Output layout

- Two independent output locations, `clientOutputDir` and `typeOutputDir` (config fields),
  rather than one shared `outputDir` with `clients/`/`types/` subfolders inside it.
- Files are written **directly** under each configured directory — no extra `clients`/`types`
  folder segment:
    - Client files: `{clientOutputDir}/{version}/{folder}/use{Resource}.ts`.
    - Type files: `{typeOutputDir}/{Resource}.ts`, plus a shared `{typeOutputDir}/index.ts` for
      `ResponseSuccessType<T>`.
- Because the two directories are independently configurable (not both nested under one root),
  the relative import from a client file to its types is computed dynamically
  (`path.relative`) rather than assumed at a fixed depth.
- `formatCommand`, if set, runs once against both `clientOutputDir` and `typeOutputDir` after
  generation finishes.

## 3. Current Implementation

### 3.1 File layout

```
src/packages/generateAPI/
├── scripts/
│   └── cli.ts                       # bin entry: subcommand router, spec download, format-command run
├── contracts/
│   └── FrameworkGenerator.ts         # generator contract (+ GeneratedFile, GeneratorContext/Factory for custom modules)
├── parsers/
│   └── OperationParser.ts            # walks every path/method, runs the resolvers -> ParsedAPI IR
├── resolvers/                        # one class per concern, spec -> IR only, no code emission
│   ├── NamingResolver.ts            # operationId/tags/path -> version/folder/resource/method names
│   ├── ParameterResolver.ts          # path/query params, hook-vs-method split + group reconciliation
│   ├── RequestBodyResolver.ts        # JSON / multipart body -> usable type expression
│   ├── ResponseResolver.ts           # unwraps the { data: T } envelope
│   ├── CacheResolver.ts             # x-cache-config vendor extension
│   ├── DocResolver.ts               # summary/description/deprecation/tag docs
│   └── TypeResolver.ts              # OpenAPI Schema -> TS type text ($ref/array/enum/union/nullable-aware)
├── generators/
│   ├── GeneratorManager.ts           # orchestrates a run; resolves built-in driver or custom module from config
│   ├── TypeFileGenerator.ts          # framework-neutral type files (shared by every driver)
│   └── frameworks/
│       └── ReactClientGenerator.ts   # React driver: ParsedAPI -> type files + use{Resource}.ts hook files
├── support/
│   ├── ConfigLoader.ts              # resolves + validates client-generator.config.json
│   ├── DocUtil.ts                   # JSDoc block/inline rendering (sanitized against spec text)
│   ├── FileBuilder.ts               # fs writes rooted at the config directory
│   ├── OperationGrouper.ts          # version/folder/resource grouping (one group per client file)
│   └── StringUtil.ts                # camelCase / pascalCase
└── types/
    ├── Config.ts                    # ClientGeneratorConfig / RawClientGeneratorConfig
    ├── OpenAPISpec.ts               # OpenAPI 3.1 type definitions
    └── ResolvedOperation.ts          # the framework-neutral IR (ResolvedOperation, ParsedAPI, ...)
```

The pipeline is split into a framework-neutral parsing side and swappable code emission:
`OperationParser` + the `resolvers/` turn the spec into a `ParsedAPI` IR, and a generator
implementing `FrameworkGenerator` (`generate(): GeneratedFile[]`) owns everything after that —
grouping, file layout, type files, and client code. Supporting another built-in framework
(e.g. Vue) means adding one driver class under `generators/frameworks/` and a case in
`GeneratorManager.resolveDriver()`; users can also plug in their own generator module without
touching this package at all (§2.7) — nothing on the parsing side changes either way.

### 3.2 Config schema (`types/Config.ts`)

| Field              | Required  | Description                                                                                                                       |
| ------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `specUrl`          | yes       | GET-able URL returning the OpenAPI spec as JSON. No auth applied.                                                                 |
| `useAPIImportPath` | yes       | Import specifier used verbatim in every generated client file to reach the consumer's `useAPI` hook, e.g. `"../../hooks/useAPI"`. |
| `clientOutputDir`  | yes       | Where client hook files are written, relative to the config file.                                                                 |
| `typeOutputDir`    | yes       | Where TS type files (incl. shared `index.ts`) are written, relative to the config file.                                           |
| `formatCommand`    | no        | Shell command run after generation, e.g. `"npx prettier --write"`; gets both output dirs appended as arguments.                   |
| `framework`        | no        | Built-in driver name (`"react"`, the default) or a path to a custom generator module, resolved relative to the config file (§2.7). |
| `rootDir`          | (derived) | Absolute directory of the resolved config file; not set by the user.                                                              |

### 3.3 Generation pipeline (`GeneratorManager.generate()`)

1. `OperationParser.parse()` builds the `ParsedAPI` IR: a `schemaGroups` map (`schema key ->
   resource group name`) from `components.schemas`, plus every `(path, method)` resolved into a
   `ResolvedOperation` — version/folder/resource/method naming, path/query params, request body
   (JSON or `multipart/form-data`), response type, and cache config (§2.6) — each concern handled
   by its own resolver class.
2. `resolveDriver()` picks the generator from `config.framework`: a built-in driver class, or a
   user module loaded with dynamic `import()` and called as a factory with the
   `GeneratorContext` (§2.7).
3. The generator's `generate()` returns every file to write. The built-in React driver emits the
   shared `${typeOutputDir}/index.ts` (`ResponseSuccessType<T>`) and one type file per resource
   group via `TypeFileGenerator`, then groups operations by `(version, folder, resource)`
   (`OperationGrouper`), reconciles each group's path params
   (`ParameterResolver.reconcileForGroup`), and assembles one client hook file per group.
4. `FileBuilder` writes every generated file relative to the config's directory.

### 3.4 CLI usage

```bash
npx @gnanamoorthy/react-native-utils generate-client --config ./client-generator.config.json
```

Published via `package.json`'s `"bin": { "react-native-utils": "./lib/cli/scripts/cli.js" }`,
built by `npm run build:cli` (`tsc -p tsconfig.cli.json`), which runs as part of `"prepare"`
alongside the normal `bob build`.

### 3.5 Example / local testing setup

- `example/openapi/spec.json` — a static local copy of a real spec (VoiceBilling), used as a
  fixture so the generator can be exercised without a live backend. Gitignored, dev-only.
- `example/scripts/serve-openapi.js` — a zero-dependency Node static server exposing that fixture
  over HTTP (default port `4879`, chosen to avoid colliding with more common dev-server ports),
  so `specUrl` can point at `http://localhost:4879/spec.json` during local testing.
- `example/client-generator.config.json` — the example app's own config (currently pointed at a
  real backend spec, not the local fixture, for real-world testing).
- `example/src/hooks/useAPI.ts` — the example app's `createAPI({...})` instance, which
  `useAPIImportPath` in the config points at.
- `example/src/generated/` — the generated output (gitignored, regenerated on demand).
- `example/codegen/flat-functions-generator.js` — a working custom generator module (§2.7):
  emits flat framework-free `fetch` functions instead of React hooks, reusing the built-in type
  files via `support.generateTypeFiles()`.

### 3.6 Sample generated output

```ts
// {clientOutputDir}/V1/BusinessUnit/useExpense.ts
import React from 'react';
import useAPI from '../../../../hooks/useAPI';
import {getCacheKey} from '@gnanamoorthy/react-native-utils';
import type {GetExpensesResponse, CreateExpenseResponse, UpdateExpenseRequest} from '../../../types/Expense';

export default function useExpense({businessUnit}: {businessUnit: number}) {
    const {loading: gettingExpenses, request: getExpensesRequest, invalidateCache: invalidateExpensesCache} = useAPI();
    const {loading: postingExpense, request: createExpenseRequest} = useAPI();

    const getExpenses = React.useCallback(() => {
        return getExpensesRequest<GetExpensesResponse>({
            method: 'GET',
            endpoint: `/v1/business-units/${businessUnit}/expenses`,
            cacheConfig: {
                ttl: 300000,
                key: getCacheKey({
                    method: 'GET',
                    endpoint: `/v1/business-units/${businessUnit}/expenses`,
                }),
            },
        });
    }, [getExpensesRequest, businessUnit]);

    const invalidateExpenses = React.useCallback(() => {
        return invalidateExpensesCache(
            getCacheKey({
                method: 'GET',
                endpoint: `/v1/business-units/${businessUnit}/expenses`,
            }),
        );
    }, [invalidateExpensesCache, businessUnit]);

    const createExpense = React.useCallback(
        ({body}: {body: UpdateExpenseRequest}) => {
            return createExpenseRequest<CreateExpenseResponse>({
                method: 'POST',
                endpoint: `/v1/business-units/${businessUnit}/expenses`,
                body: JSON.stringify(body),
                headers: new Headers({'Content-Type': 'application/json'}),
            });
        },
        [createExpenseRequest, businessUnit],
    );

    return {
        gettingExpenses,
        getExpenses,
        invalidateExpenses,
        postingExpense,
        createExpense,
    };
}
```

Note `businessUnit` is a **parent** id here (`/business-units/{businessUnit}/expenses`), so it's
bound on the hook and required (every operation in this file needs it) — a resource with its own
trailing id (e.g. `getExpense({ expense })`) would bind it on the method instead (§2.5).

### 3.7 Known scope limits

- Pagination: query-parameterized `GET`s never get `cacheConfig`, even if `x-cache-config` is
  present on the operation.
- Cache TTL is a single static value per endpoint from the spec; it is not derived from the
  actual `Cache-Control` response header at request time.
- Only the React driver is implemented. The framework seam exists (`FrameworkGenerator` contract,
  framework-neutral `ParsedAPI` IR, `config.framework` selection), but a Vue driver hasn't been
  written yet — there is also no Vue equivalent of the `createAPI`/`useAPI` runtime to generate
  against, so Vue output can't currently be verified end-to-end.

# OpenAPI Client Generator — Requirements & Implementation

`@gnanamoorthy/react-native-utils` ships a code generator (`clientGenerator`) that reads an
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
- `clientGenerator` exists to stop hand-writing hooks like `useProduct()`/`useContact()` against
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
- Optional: `formatCommand`.
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
  - `tsconfig.cli.json` compiles `src/packages/clientGenerator/**` to CommonJS under `lib/cli`.
  - `clientGenerator` is excluded from the RN-facing `bob` build (`module`/`typescript` targets)
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
- Nested routes (e.g. a `BusinessUnit`'s `Contact` sub-resource) are kept in a separate
  `folder` subdirectory from an unrelated top-level resource of the same name, so
  `V1.BusinessUnit.Contact.getContacts` and `V1.Contact.Contact.getContact` don't collide into
  the same generated file.
- Generated code is passed through the user's own formatter (see §2.7) rather than the
  generator's own fixed 4-space style, so output matches the consuming project's conventions
  (indent width, quotes, line length, etc.) automatically.

### 2.6 Caching
- Per-endpoint cache behavior is read from an `x-cache-config` OpenAPI vendor extension on the
  operation, e.g. `{ "ttl": 300 }` (seconds).
- Only applies to `GET` operations with no query parameters — caching a paginated/query-filtered
  endpoint is intentionally out of scope for now.
- When present, the generated method's `request()` call gets a `cacheConfig: { ttl, key }`
  (key computed via `createAPI`'s exported `getCacheKey(method, endpoint)`), and a companion
  `invalidate{Resource}` method is generated next to it, taking the same path params and
  recomputing the identical cache key to call `invalidateCache`.

### 2.7 Output layout
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
src/packages/clientGenerator/
├── scripts/
│   ├── cli.ts            # bin entry: subcommand router, spec download, format-command run
│   ├── generator.ts       # APIClientGenerator: resolves the spec and emits types + client hooks
│   ├── parser.ts          # OpenAPIParser: thin accessors over the raw spec (paths, components, ...)
│   ├── typeResolver.ts     # TypeResolver: OpenAPI Schema -> TS type text ($ref/array/enum/union/nullable-aware)
│   └── files.ts           # FileBuilder: fs writes + a small block-text helper
├── types/
│   ├── Config.ts          # ClientGeneratorConfig / RawClientGeneratorConfig
│   └── OpenAPISpec.ts      # OpenAPI 3.1 type definitions
└── utils/
    ├── config.ts           # loadConfig(): resolves + validates client-generator.config.json
    └── stringUtil.ts        # camelCase / pascalCase
```

`generator.ts` currently owns the whole pipeline in one class, `APIClientGenerator`:
resolving operations from the spec, generating type files, and emitting the React hook files —
there is no separate abstraction yet for targeting a non-React frontend.

### 3.2 Config schema (`types/Config.ts`)

| Field              | Required | Description                                                                 |
| ------------------ | -------- | ----------------------------------------------------------------------------- |
| `specUrl`           | yes      | GET-able URL returning the OpenAPI spec as JSON. No auth applied.             |
| `useAPIImportPath`   | yes      | Import specifier used verbatim in every generated client file to reach the consumer's `useAPI` hook, e.g. `"../../hooks/useAPI"`. |
| `clientOutputDir`    | yes      | Where client hook files are written, relative to the config file.             |
| `typeOutputDir`      | yes      | Where TS type files (incl. shared `index.ts`) are written, relative to the config file. |
| `formatCommand`      | no       | Shell command run after generation, e.g. `"npx prettier --write"`; gets both output dirs appended as arguments. |
| `rootDir`            | (derived) | Absolute directory of the resolved config file; not set by the user.         |

### 3.3 Generation pipeline (`APIClientGenerator.generate()`)

1. Build a `schemaGroups` map (`schema key -> resource group name`) from `components.schemas`.
2. Write the shared `${typeOutputDir}/index.ts` (`ResponseSuccessType<T>`).
3. Resolve every `(path, method)` in the spec into a `ResolvedOperation`: version/folder/resource/
   method naming, path/query params, request body (JSON or `multipart/form-data`), response type,
   and cache config (§2.6).
4. Write one type file per resource group (`writeTypeFiles`/`writeTypeFile`).
5. Group operations by `(version, folder, resource)` and write one client hook file per group
   (`writeClientFiles`/`writeClientFile`/`buildMethod`).

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

### 3.6 Sample generated output

```ts
// {clientOutputDir}/V1/BankAccount/useBankAccount.ts
import React from 'react';
import useAPI from '../../../../hooks/useAPI';
import { getCacheKey } from '@gnanamoorthy/react-native-utils';
import type {
  GetBankAccountsResponse,
  GetBankAccountResponse,
  UpdateBankAccountResponse,
  UpdateBankAccountRequest,
  DeleteBankAccountResponse,
} from '../../../types/BankAccount';

export default function useBankAccount() {
  const {
    loading: gettingBankAccounts,
    request: getBankAccountsRequest,
    invalidateCache: invalidateBankAccountsCache,
  } = useAPI();
  const { loading: gettingBankAccount, request: getBankAccountRequest } = useAPI();
  const { loading: patchingBankAccount, request: updateBankAccountRequest } = useAPI();
  const { loading: deletingBankAccount, request: deleteBankAccountRequest } = useAPI();

  const getBankAccounts = React.useCallback(
    (customer: number) =>
      getBankAccountsRequest<GetBankAccountsResponse>({
        method: 'GET',
        endpoint: `/v1/customers/${customer}/bank-accounts`,
        cacheConfig: {
          ttl: 300,
          key: getCacheKey('GET', `/v1/customers/${customer}/bank-accounts`),
        },
      }),
    [getBankAccountsRequest]
  );

  const invalidateBankAccounts = React.useCallback(
    (customer: number) =>
      invalidateBankAccountsCache(
        getCacheKey('GET', `/v1/customers/${customer}/bank-accounts`)
      ),
    [invalidateBankAccountsCache]
  );

  // ...getBankAccount / updateBankAccount / deleteBankAccount

  return {
    gettingBankAccounts,
    getBankAccounts,
    invalidateBankAccounts,
    gettingBankAccount,
    getBankAccount,
    patchingBankAccount,
    updateBankAccount,
    deletingBankAccount,
    deleteBankAccount,
  };
}
```

### 3.7 Known scope limits

- Pagination: query-parameterized `GET`s never get `cacheConfig`, even if `x-cache-config` is
  present on the operation.
- Cache TTL is a single static value per endpoint from the spec; it is not derived from the
  actual `Cache-Control` response header at request time.
- Only React hook output is implemented; there is no separate interface for targeting other
  frontend frameworks (e.g. Vue) yet.

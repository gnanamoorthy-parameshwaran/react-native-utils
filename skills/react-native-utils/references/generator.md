# generateAPI: configuring, running and reading the output

Full requirements and output rules: [docs/requirement.md](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/blob/main/docs/requirement.md)
in the package repository (§2.2 config, §2.5 client generation, §2.7 custom generators, §3.6
sample output).

## Config file (`client-generator.config.json`)

```json
{
    "specUrl": "http://localhost:4879/spec.json",
    "useAPIImportPath": "../../../../hooks/useAPI",
    "clientOutputDir": "src/generated/clients",
    "typeOutputDir": "src/generated/types",
    "formatCommand": "npx prettier --write"
}
```

- Required: `specUrl`, `useAPIImportPath`, `clientOutputDir`, `typeOutputDir`.
- Optional: `formatCommand` (run on both output dirs after generation), `framework` (built-in
  `"react"` or a path to a custom generator module).
- `useAPIImportPath` is used verbatim in every generated file; the module must default-export `useAPI`.
- Field docs: `node_modules/@gnanamoorthy/react-native-utils/src/packages/generateAPI/types/Config.ts`.

## Running it

```sh
npx @gnanamoorthy/react-native-utils generate-client --config ./client-generator.config.json
```

Without `--config`, `client-generator.config.json` is resolved from the cwd. `specUrl` is fetched
with a plain unauthenticated GET. Output paths resolve relative to the config file.

## What comes out

- One `use{Resource}.ts` hook file per `(version, folder, resource)` group, and one type file per
  resource group.
- Each `use{Resource}()` hook returns typed request methods plus a loading flag per method, e.g.
  `{gettingInvoices, getInvoices, postingInvoice, createInvoice}`.
- Parent path params (e.g. `businessUnit`) are hook props; a resource's own id and `params`/`body`
  are method props.
- **API clients only**: no query hooks, invalidate helpers or cache options. An `x-cache-config`
  vendor extension in the spec is ignored. Cache on the screen with `useQuery`:
  [../examples/generated-client-query.tsx](../examples/generated-client-query.tsx).
- Generated files say "do not edit by hand"; change the spec or the generator instead.

## Custom output

`framework` can point to a JS module (resolved relative to the config file) whose factory receives
the parsed spec and returns the files to write. Use it when a project wants a different output shape
but the same spec parsing. Contract: `node_modules/@gnanamoorthy/react-native-utils/src/packages/generateAPI/contracts/FrameworkGenerator.ts`.
Working example: [example/codegen/flat-functions-generator.js](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/blob/main/example/codegen/flat-functions-generator.js)
in the package repository.

---
name: react-native-utils-api
description: Work on the @gnanamoorthy/react-native-utils package itself -- its createAPI runtime (useAPI, useQuery, invalidateQueries), its generateAPI code generator (`generate-client`), the example app, and the AI skill the package ships to its users (`skills/react-native-utils`, installed with `add-skill`). Use whenever the task changes, debugs or tests code under src/packages/createAPI or src/packages/generateAPI, uses the API layer in the example app, or updates the shipped skill or the package docs.
---

# Maintaining @gnanamoorthy/react-native-utils (API layer)

This repository contains:

- **`src/packages/createAPI`**: the runtime. `createAPI()` returns `{ useAPI, useQuery, invalidateQueries }`;
  all logic is in `client.ts`, shapes in `types.ts`.
- **`src/packages/generateAPI`**: the Node-only CLI (`generate-client`, `add-skill`) and code generator.
- **`skills/react-native-utils`**: the skill shipped to the package's **users** and copied into their
  projects by `npx @gnanamoorthy/react-native-utils add-skill`. It's the single source of truth for
  how the API layer is used.
- **`example/`**: an app that consumes the package (`example/src/hooks/useAPI.ts` is its `createAPI` instance).

## Which file to read

| Task                                                                              | Read                                                                                                            |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Use or debug `createAPI` / `useAPI` / `useQuery` (in the example app or in tests) | [skills/react-native-utils/references/runtime.md](../../../skills/react-native-utils/references/runtime.md)     |
| Configure or run the generator, or read its output                                | [skills/react-native-utils/references/generator.md](../../../skills/react-native-utils/references/generator.md) |
| Change anything under `src/packages/generateAPI/`                                 | [references/generator-internals.md](references/generator-internals.md) first                                    |
| Why each piece exists (for docs or discussions)                                   | [docs/api-layer.md](../../../docs/api-layer.md)                                                                 |
| Generator requirements and output rules                                           | [docs/requirement.md](../../../docs/requirement.md)                                                             |

## Keep the shipped skill in sync

Users get `skills/react-native-utils` as their AI instructions, so it must match the code:

- When a change adds, removes or alters a `createAPI` option, a `useQuery` option or result field,
  `invalidateQueries` behaviour, a generator config field or the generated output shape, update
  `skills/react-native-utils` (SKILL.md, `references/`, `examples/`) in the same change.
- Paths in the shipped skill must work inside a user's project: point to
  `node_modules/@gnanamoorthy/react-native-utils/...` or to the GitHub repository, never to repo-only
  files such as `docs/` or `example/`.
- `skills/react-native-utils/examples/*` are typechecked by the project's `tsc` (and the pre-commit
  hook), so an API change that breaks them fails the commit. Keep them compiling.
- `skills/` is published via `package.json` `files` and excluded from the library build in
  `tsconfig.build.json`.

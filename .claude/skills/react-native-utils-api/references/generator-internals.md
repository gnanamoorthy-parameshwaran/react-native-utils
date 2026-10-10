# Before changing generator internals

Applies to any change under `src/packages/generateAPI/`.

1. **Read [docs/requirement.md](../../../../docs/requirement.md) in full.** It's the requirements
   record and explains _why_ the output is shaped the way it is (e.g. why there's no shared response
   wrapper type).
2. **Follow the folder layout.** One class per concern: `parsers/`, `resolvers/` (spec → IR only),
   `generators/` (IR → files), `support/`, `contracts/`, `types/`. A new framework is one driver
   class plus one case in `GeneratorManager`.
3. **Rebuild the CLI** after any change: `npm run build:cli`. The example's `generate:api` script
   runs the compiled `lib/cli`, not the TS source.
4. **Regenerate and diff before trusting a change.** `tsc` catches errors in the generator, not
   malformed _generated_ output. Use the local spec fixture and scratch output dirs so real output is
   never overwritten:
    ```sh
    node example/scripts/serve-openapi.js        # serves example/openapi/spec.json on :4879
    node lib/cli/scripts/cli.js generate-client --config <scratch-config.json>
    ```
    Generate before and after the change and diff the two output trees.
5. **Keep output byte-stable.** Files the change isn't meant to touch must come out identical.
   Report any unexpected diff.
6. **Keep docs in sync.** If a change closes or adds a limit, update docs/requirement.md §3.7
   ("Known scope limits") in the same change. If the config or output shape changes, update the
   shipped skill too: [generator.md](../../../../skills/react-native-utils/references/generator.md)
   and its examples.

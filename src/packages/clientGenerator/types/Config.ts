export type ClientGeneratorConfig = {
  /** GET-able URL that returns the OpenAPI spec as JSON. No auth is applied. */
  specUrl: string;
  /**
   * Import specifier used verbatim in every generated client file to reach
   * your `useAPI` hook, e.g. "@/hooks/useAPI" or "../../hooks/useAPI".
   */
  useAPIImportPath: string;
  /** Where generated `types/` and `clients/` folders are written, relative to this config file. */
  outputDir: string;
  /**
   * Shell command run once generation finishes, with `outputDir` appended as its
   * final argument, e.g. "npx prettier --write". Runs from the config file's
   * directory. Omit to leave generated files as written.
   */
  formatCommand?: string;
  /** Absolute directory of the resolved config file; output paths are resolved against this. */
  rootDir: string;
};

export type RawClientGeneratorConfig = Omit<ClientGeneratorConfig, 'rootDir'>;

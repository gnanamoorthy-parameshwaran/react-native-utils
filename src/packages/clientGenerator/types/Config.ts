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
  /** Absolute directory of the resolved config file; output paths are resolved against this. */
  rootDir: string;
};

export type RawClientGeneratorConfig = Omit<ClientGeneratorConfig, 'rootDir'>;

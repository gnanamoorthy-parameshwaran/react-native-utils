export type ClientGeneratorConfig = {
    /** GET-able URL that returns the OpenAPI spec as JSON. No auth is applied. */
    specUrl: string;
    /**
     * Which generator emits the output files. Either a built-in driver name
     * ('react' is the only one shipped today) or a path to a custom generator
     * module ("./codegen/my-generator.js", resolved relative to this config
     * file) whose factory receives the parsed IR and returns the files to
     * write -- see contracts/FrameworkGenerator.ts. Defaults to 'react'.
     */
    framework?: 'react' | (string & {});
    /**
     * Import specifier used verbatim in every generated client file to reach
     * your `useAPI` hook, e.g. "@/hooks/useAPI" or "../../hooks/useAPI".
     */
    useAPIImportPath: string;
    /** Where generated client hook files are written, relative to this config file. Files go directly under this path (e.g. clientOutputDir/{version}/{folder}/use{Resource}.ts) -- no extra "clients" subfolder is added. */
    clientOutputDir: string;
    /** Where generated TS type files (including the shared index.ts) are written, relative to this config file. Files go directly under this path -- no extra "types" subfolder is added. */
    typeOutputDir: string;
    /**
     * Shell command run once generation finishes, with `clientOutputDir` and
     * `typeOutputDir` appended as its final two arguments, e.g. "npx prettier --write".
     * Runs from the config file's directory. Omit to leave generated files as written.
     */
    formatCommand?: string;
    /** Absolute directory of the resolved config file; output paths are resolved against this. */
    rootDir: string;
};

export type RawClientGeneratorConfig = Omit<ClientGeneratorConfig, 'rootDir'>;

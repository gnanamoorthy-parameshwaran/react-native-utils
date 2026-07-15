import type DocUtil from '../support/DocUtil.ts';
import type StringUtil from '../support/StringUtil.ts';
import type {ClientGeneratorConfig} from '../types/Config.ts';
import type {ParsedAPI, ResolvedOperation} from '../types/ResolvedOperation.ts';

/** One file of generated source, addressed relative to the config's rootDir. */
export type GeneratedFile = {
    directory: string;
    name: string;
    content: string;
};

/**
 * A framework generator owns everything after parsing: it turns the parsed
 * spec into the complete set of files to write -- clients, type files, and
 * whatever layout it wants. Built-in drivers (React) implement it, and a
 * custom generator module configured via `framework: "./path/to/module.js"`
 * must return an object satisfying it.
 */
export interface FrameworkGenerator {
    generate(): GeneratedFile[];
}

/**
 * Reusable pieces of the built-in pipeline, handed to custom generator
 * modules so "define your own structure" doesn't mean "reimplement the
 * parts you don't care about".
 */
export type GeneratorSupport = {
    /** The built-in grouping: one group per client file, keyed by version/folder/resource. */
    groupOperations: (operations: ResolvedOperation[]) => ResolvedOperation[][];
    /** The built-in hook-vs-method path param reconciliation for one group (see ParameterResolver.reconcileForGroup). */
    reconcilePathParams: (group: ResolvedOperation[]) => ResolvedOperation[];
    /** The built-in framework-neutral type files -- for custom generators that only restyle the clients. */
    generateTypeFiles: () => GeneratedFile[];
    stringUtil: typeof StringUtil;
    docUtil: typeof DocUtil;
};

/** Everything a custom generator module's factory receives. */
export type GeneratorContext = {
    parsed: ParsedAPI;
    config: ClientGeneratorConfig;
    support: GeneratorSupport;
};

/**
 * The shape a custom generator module must export (as its default or its
 * whole `module.exports`): a factory that takes the context and returns a
 * FrameworkGenerator.
 */
export type GeneratorFactory = (context: GeneratorContext) => FrameworkGenerator;

import path from 'path';
import {pathToFileURL} from 'url';
import TypeFileGenerator from './TypeFileGenerator.ts';
import ReactClientGenerator from './frameworks/ReactClientGenerator.ts';
import OperationParser from '../parsers/OperationParser.ts';
import ParameterResolver from '../resolvers/ParameterResolver.ts';
import TypeResolver from '../resolvers/TypeResolver.ts';
import DocUtil from '../support/DocUtil.ts';
import FileBuilder from '../support/FileBuilder.ts';
import OperationGrouper from '../support/OperationGrouper.ts';
import StringUtil from '../support/StringUtil.ts';
import type {FrameworkGenerator, GeneratorContext, GeneratorFactory} from '../contracts/FrameworkGenerator.ts';
import type {ClientGeneratorConfig} from '../types/Config.ts';
import type {OpenAPI} from '../types/OpenAPISpec.ts';
import type {ParsedAPI} from '../types/ResolvedOperation.ts';

/**
 * Orchestrates one generation run: parses the spec into the framework-neutral
 * IR, resolves the framework generator named by `config.framework` -- a
 * built-in driver ("react") or a user module ("./codegen/my-generator.js",
 * resolved relative to the config file) -- and writes whatever files it
 * produces. The generator is the only framework-specific piece: supporting a
 * new built-in framework means one new class under generators/frameworks plus
 * a case in `resolveDriver`.
 */
export default class GeneratorManager {
    protected config: ClientGeneratorConfig;
    protected parsed: ParsedAPI;
    protected fileBuilder: FileBuilder;

    constructor(spec: OpenAPI, config: ClientGeneratorConfig) {
        this.config = config;
        this.parsed = new OperationParser(spec).parse();
        this.fileBuilder = new FileBuilder(config.rootDir);
    }

    public async generate() {
        const generator = await this.resolveDriver();
        generator.generate().forEach(file => this.fileBuilder.createFile(file));
    }

    protected async resolveDriver(): Promise<FrameworkGenerator> {
        const framework: string = this.config.framework ?? 'react';

        if (this.isModuleSpecifier(framework)) {
            return this.loadCustomGenerator(framework);
        }

        switch (framework) {
            case 'react':
                return new ReactClientGenerator(this.parsed, this.config);
            default:
                throw new Error(
                    `Unsupported framework "${framework}" in client generator config. ` +
                        `Available: react. To use a custom generator, pass a module path like "./codegen/my-generator.js".`,
                );
        }
    }

    /** A path (or anything that ends like a JS file) selects a custom generator module; a bare name selects a built-in driver. */
    private isModuleSpecifier(framework: string): boolean {
        return framework.includes('/') || framework.includes('\\') || /\.(js|cjs|mjs)$/.test(framework);
    }

    /**
     * Loads a user-authored generator module (CJS or ESM). The module's default
     * export (or its whole `module.exports`) must be a `GeneratorFactory`:
     * `(context) => ({ generate() })`. See `contracts/FrameworkGenerator.ts`.
     */
    private async loadCustomGenerator(specifier: string): Promise<FrameworkGenerator> {
        const modulePath = path.resolve(this.config.rootDir, specifier);
        const loaded: unknown = await import(pathToFileURL(modulePath).href);

        const moduleExports = loaded as {default?: unknown};
        const factory = moduleExports.default ?? moduleExports;
        if (typeof factory !== 'function') {
            throw new Error(`Custom generator at ${modulePath} must export a factory function: (context) => ({ generate() { ... } }).`);
        }

        const generator: unknown = (factory as GeneratorFactory)(this.buildContext());
        if (!generator || typeof (generator as FrameworkGenerator).generate !== 'function') {
            throw new Error(`The factory exported by ${modulePath} must return an object with a generate() method.`);
        }

        return generator as FrameworkGenerator;
    }

    /** The parsed IR plus the reusable built-in pipeline pieces, so a custom generator only rewrites what it wants to change. */
    private buildContext(): GeneratorContext {
        const grouper = new OperationGrouper();
        const parameters = new ParameterResolver(new TypeResolver());

        return {
            parsed: this.parsed,
            config: this.config,
            support: {
                groupOperations: operations => grouper.group(operations),
                reconcilePathParams: group => parameters.reconcileForGroup(group),
                generateTypeFiles: () => new TypeFileGenerator(this.parsed, this.config).generate(),
                stringUtil: StringUtil,
                docUtil: DocUtil,
            },
        };
    }
}

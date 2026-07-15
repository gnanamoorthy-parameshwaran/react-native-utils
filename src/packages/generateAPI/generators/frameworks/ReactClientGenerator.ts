import path from 'path';
import TypeFileGenerator from '../TypeFileGenerator.ts';
import NamingResolver from '../../resolvers/NamingResolver.ts';
import ParameterResolver from '../../resolvers/ParameterResolver.ts';
import TypeResolver from '../../resolvers/TypeResolver.ts';
import DocUtil from '../../support/DocUtil.ts';
import OperationGrouper from '../../support/OperationGrouper.ts';
import StringUtil from '../../support/StringUtil.ts';
import type {FrameworkGenerator, GeneratedFile} from '../../contracts/FrameworkGenerator.ts';
import type {ClientGeneratorConfig} from '../../types/Config.ts';
import type {HttpMethodKey, ParsedAPI, ResolvedOperation} from '../../types/ResolvedOperation.ts';

type ObjectParamField = {name: string; type: string; required: boolean};

/**
 * React driver: assembles each operation group into a `use{Resource}` hook file
 * built on `useAPI` -- one `React.useCallback` per operation, per-operation
 * loading flags, and cache invalidation helpers for cached GETs -- alongside
 * the shared framework-neutral type files.
 */
export default class ReactClientGenerator implements FrameworkGenerator {
    protected naming = new NamingResolver();
    protected grouper = new OperationGrouper();
    protected parameters = new ParameterResolver(new TypeResolver());

    constructor(
        protected parsed: ParsedAPI,
        protected config: ClientGeneratorConfig,
    ) {}

    public generate(): GeneratedFile[] {
        return [
            ...new TypeFileGenerator(this.parsed, this.config).generate(),
            ...this.grouper.group(this.parsed.operations).map(group => this.clientFile(this.parameters.reconcileForGroup(group))),
        ];
    }

    /** One complete `use{Resource}.ts` hook file for a reconciled operation group. */
    private clientFile(group: ResolvedOperation[]): GeneratedFile {
        const first = group[0];
        if (!first) throw new Error('Cannot generate a client file from an empty operation group.');

        const importsByGroup = new Map<string, Set<string>>();
        const hookLines: string[] = [];
        const callbackCodes: string[] = [];
        const returnItems: string[] = [];
        let usesCache = false;

        group.forEach(operation => {
            const built = this.buildMethod(operation);
            built.typeRefs.forEach(({name, group: owningGroup}) => {
                const names = importsByGroup.get(owningGroup) ?? new Set<string>();
                names.add(name);
                importsByGroup.set(owningGroup, names);
            });
            hookLines.push(built.hookLine);
            callbackCodes.push(built.callbackCode);
            returnItems.push(built.loadingName, ...built.methodNames);
            usesCache = usesCache || built.usesCache;
        });

        const clientDirectory = `${this.config.clientOutputDir}/${first.version}/${first.folder}`;
        // clientOutputDir and typeOutputDir are independent config paths (no longer
        // both nested under one shared outputDir), so the relative import between
        // them has to be computed rather than assumed at a fixed depth.
        const typeImportBase = this.relativeImportPath(clientDirectory, this.config.typeOutputDir);

        const typeImportLines: string[] = [];
        importsByGroup.forEach((names, groupName) => {
            typeImportLines.push(`import type { ${[...names].join(', ')} } from '${typeImportBase}/${groupName}';`);
        });

        const header = [
            `import React from 'react';`,
            `import useAPI from '${this.config.useAPIImportPath}';`,
            ...(usesCache ? [`import { getCacheKey } from '@gnanamoorthy/react-native-utils';`] : []),
            ...typeImportLines,
        ].join('\n');

        // A hook-level (parent) param is required only if every operation in this
        // file needs it -- files can mix scopes (e.g. a nested list alongside
        // top-level single-item CRUD), so one operation's parent id can't be
        // forced on operations that never reference it.
        const hookParamInfo = new Map<string, {type: string; count: number; description?: string}>();
        group.forEach(operation => {
            operation.hookParams.forEach(param => {
                const info = hookParamInfo.get(param.name) ?? {
                    type: param.type,
                    count: 0,
                    description: undefined as string | undefined,
                };
                info.count += 1;
                info.description = info.description ?? param.description;
                hookParamInfo.set(param.name, info);
            });
        });
        const hookFields = [...hookParamInfo.entries()].map(([name, info]) => ({
            name,
            type: info.type,
            required: info.count === group.length,
            description: info.description ?? `The \`${name}\` path parameter, shared by every request in this hook.`,
        }));

        const info = this.parsed.info;
        const tagDescription = group.find(operation => operation.docs.tagDescription)?.docs.tagDescription;
        const hookDoc = DocUtil.block([
            tagDescription ?? `Client hook for the ${first.resource} endpoints.`,
            '',
            `Generated from the ${info.title} OpenAPI spec (v${info.version}) -- do not edit by hand.`,
            '',
            ...hookFields.map(field => `@param props.${field.name} - ${field.description}`),
        ]);

        const content = `${header}\n\n${hookDoc}\nexport default function use${first.resource}(${this.buildObjectParam(hookFields)}) {\n${hookLines.join('\n')}\n\n${callbackCodes.join('\n\n')}\n\n    return { ${returnItems.join(', ')} };\n}\n`;

        return {
            name: `use${first.resource}.ts`,
            content,
            directory: clientDirectory,
        };
    }

    /** POSIX-style relative import specifier from one config-relative output directory to another. */
    private relativeImportPath(fromDir: string, toDir: string): string {
        const fromAbs = path.join(this.config.rootDir, fromDir);
        const toAbs = path.join(this.config.rootDir, toDir);
        const relative = path.relative(fromAbs, toAbs).split(path.sep).join('/');
        return relative.startsWith('.') ? relative : `./${relative}`;
    }

    /**
     * A single destructured object parameter, e.g. `({ businessUnit }: { businessUnit: number })`,
     * so every generated hook/method takes one extensible props object instead
     * of positional args. Empty input means no parameter at all -- nothing to
     * destructure yet, and generation-time codegen means there's nothing to
     * "future-proof" ahead of an endpoint actually gaining an input.
     */
    private buildObjectParam(fields: ObjectParamField[]): string {
        if (fields.length === 0) return '';

        const names = fields.map(field => field.name).join(', ');
        const shape = fields.map(field => `${field.name}${field.required ? '' : '?'}: ${field.type};`).join(' ');
        const allOptional = fields.every(field => !field.required);

        return `{ ${names} }: { ${shape} }${allOptional ? ' = {}' : ''}`;
    }

    private buildMethod(operation: ResolvedOperation) {
        const fields: {
            name: string;
            type: string;
            required: boolean;
            description: string;
        }[] = [];

        operation.methodParams.forEach(param =>
            fields.push({
                name: param.name,
                type: param.type,
                required: true,
                description: param.description ?? `The \`${param.name}\` path parameter.`,
            }),
        );

        let requestBodyLine = '';
        if (operation.requestBody) {
            fields.push({
                name: 'body',
                type: operation.requestBody.type,
                required: true,
                description:
                    operation.docs.requestBodyDescription ??
                    (operation.requestBody.contentType === 'multipart/form-data'
                        ? 'The multipart form-data payload.'
                        : `The JSON request body (\`${operation.requestBody.type}\`).`),
            });
            requestBodyLine =
                operation.requestBody.contentType === 'application/json'
                    ? `            body: JSON.stringify(body),\n            headers: new Headers({ 'Content-Type': 'application/json' }),`
                    : `            body,`;
        }

        const hasQuery = operation.queryParams.length > 0;
        if (hasQuery) {
            const queryRequired = operation.queryParams.some(param => param.required);
            const shape = operation.queryParams.map(param => `${param.name}${param.required ? '' : '?'}: ${param.type};`).join(' ');
            fields.push({
                name: 'params',
                type: `{ ${shape} }`,
                required: queryRequired,
                description: 'Query string parameters.',
            });
        }

        const hookParamNames = operation.hookParams.map(param => param.name);
        const methodPascal = StringUtil.pascalCase(operation.methodName);
        const responseTypeName = `${methodPascal}Response`;
        const endpoint = operation.pathTemplate.replace(/\{([^}]+)\}/g, (_match, name: string) => '${' + name + '}');
        const requestName = `${operation.methodName}Request`;
        const httpMethodKey = operation.httpMethod.toLowerCase() as HttpMethodKey;
        // Strips the leading verb the same way loading names do, so the public
        // invalidate method reads as invalidateProducts/invalidateProduct rather
        // than invalidateGetProducts.
        const invalidateSuffix = this.naming.loadingSuffix(operation.methodName);
        const loadingName = this.naming.loadingName(httpMethodKey, operation.methodName);
        const invalidateName = `invalidate${invalidateSuffix}Cache`;
        const cacheKeyExpr = `getCacheKey({ method: 'GET', endpoint: \`${endpoint}\` })`;

        const hookLine = operation.cache
            ? `    const { loading: ${loadingName}, request: ${requestName}, invalidateCache: ${invalidateName} } = useAPI();`
            : `    const { loading: ${loadingName}, request: ${requestName} } = useAPI();`;

        // Hook-level params (e.g. businessUnit) aren't part of this method's own
        // object -- they're free variables closing over the hook's destructured
        // props, so they have to be in the useCallback deps alongside the request/
        // invalidate function itself or a stale value could get captured.
        const objectParam = this.buildObjectParam(fields);

        // Every method and every parameter gets a JSDoc entry -- when the spec has
        // no summary/description, a fallback derived from the endpoint keeps the
        // docs from silently going missing.
        const endpointDoc = `\`${operation.httpMethod} ${operation.pathTemplate}\``;
        const paramTags = fields.map(field => `@param props.${field.name} - ${field.description}`);
        if (hasQuery) {
            operation.queryParams.forEach(param => {
                paramTags.push(`@param props.params.${param.name} - ${param.description ?? `The \`${param.name}\` query parameter.`}`);
            });
        }

        const methodDoc = DocUtil.block(
            [
                operation.docs.summary ?? `Calls ${endpointDoc}.`,
                '',
                operation.docs.description !== operation.docs.summary ? operation.docs.description : undefined,
                '',
                operation.docs.summary ? endpointDoc : undefined,
                '',
                ...paramTags,
                `@returns ${operation.docs.responseDescription ?? `The \`${responseTypeName}\` payload.`}`,
                operation.docs.deprecated ? '@deprecated' : undefined,
                operation.docs.externalDocsUrl ? `@see ${operation.docs.externalDocsUrl}` : undefined,
            ],
            '    ',
        );

        const lines: string[] = [];
        lines.push(methodDoc);
        lines.push(`    const ${operation.methodName} = React.useCallback((${objectParam}) => {`);
        if (hasQuery) {
            lines.push(`        const query = params ? \`?\${new URLSearchParams(params as Record<string, string>).toString()}\` : '';`);
        }
        lines.push(`        return ${requestName}<${responseTypeName}>({`);
        lines.push(`            method: '${operation.httpMethod}',`, `            endpoint: \`${endpoint}${hasQuery ? '${query}' : ''}\`,`);
        if (requestBodyLine) lines.push(requestBodyLine);
        if (operation.cache) {
            lines.push(`            cacheConfig: { ttl: ${operation.cache.ttl}, key: ${cacheKeyExpr} },`);
        }
        lines.push(`        });`);
        lines.push(`    }, [${[requestName, ...hookParamNames].join(', ')}]);`);

        if (operation.cache) {
            // `cache` is only ever set for GETs with no query params, so `fields`
            // here holds at most this resource's own id -- enough to recompute the
            // same cache key the getter used.
            lines.push('');
            lines.push(
                DocUtil.block(
                    [`Invalidates the cached ${endpointDoc} response so the next \`${operation.methodName}\` call refetches.`, '', ...paramTags],
                    '    ',
                ),
            );
            lines.push(`    const invalidate${invalidateSuffix} = React.useCallback((${objectParam}) => {`);
            lines.push(`        return ${invalidateName}(${cacheKeyExpr});`);
            lines.push(`    }, [${[invalidateName, ...hookParamNames].join(', ')}]);`);
        }

        const typeRefs: {name: string; group: string}[] = [{name: responseTypeName, group: operation.resource}];
        if (operation.requestBody && operation.requestBody.type !== 'FormData') {
            const bodyType = operation.requestBody.type;
            const bodyGroup = operation.requestBody.inlineType ? operation.resource : this.parsed.schemaGroups.get(bodyType);
            if (bodyGroup) typeRefs.push({name: bodyType, group: bodyGroup});
        }

        const methodNames = operation.cache ? [operation.methodName, `invalidate${invalidateSuffix}`] : [operation.methodName];

        return {
            hookLine,
            callbackCode: lines.join('\n'),
            typeRefs,
            loadingName,
            methodNames,
            usesCache: !!operation.cache,
        };
    }
}

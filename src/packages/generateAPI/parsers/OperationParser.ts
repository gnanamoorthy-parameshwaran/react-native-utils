import CacheResolver from '../resolvers/CacheResolver.ts';
import DocResolver from '../resolvers/DocResolver.ts';
import NamingResolver from '../resolvers/NamingResolver.ts';
import ParameterResolver from '../resolvers/ParameterResolver.ts';
import RequestBodyResolver from '../resolvers/RequestBodyResolver.ts';
import ResponseResolver from '../resolvers/ResponseResolver.ts';
import TypeResolver from '../resolvers/TypeResolver.ts';
import StringUtil from '../support/StringUtil.ts';
import {HTTP_METHODS} from '../types/ResolvedOperation.ts';
import type {OpenAPI, Operation, PathItem} from '../types/OpenAPISpec.ts';
import type {HttpMethodKey, ParsedAPI, ResolvedOperation} from '../types/ResolvedOperation.ts';

/**
 * Walks every path/method in the spec and runs the per-concern resolvers over
 * each operation, producing the framework-neutral `ParsedAPI` IR that the
 * framework drivers consume. Nothing downstream of this class touches the raw
 * spec again.
 */
export default class OperationParser {
    protected spec: OpenAPI;
    protected naming = new NamingResolver();
    protected parameters: ParameterResolver;
    protected requestBodies: RequestBodyResolver;
    protected responses: ResponseResolver;
    protected cache = new CacheResolver();
    protected docs: DocResolver;

    constructor(spec: OpenAPI) {
        this.spec = spec;

        const typeResolver = new TypeResolver();
        this.parameters = new ParameterResolver(typeResolver);
        this.requestBodies = new RequestBodyResolver(typeResolver);
        this.responses = new ResponseResolver(typeResolver);

        const tagDescriptions = new Map<string, string>();
        (spec.tags ?? []).forEach(tag => {
            if (tag.description) tagDescriptions.set(tag.name, tag.description);
        });
        this.docs = new DocResolver(tagDescriptions);
    }

    public parse(): ParsedAPI {
        const schemas = this.spec.components?.schemas ?? {};

        const schemaGroups = new Map<string, string>();
        Object.keys(schemas).forEach(key => schemaGroups.set(key, this.naming.schemaGroupName(key)));

        return {
            info: this.spec.info,
            operations: this.parseOperations(),
            schemas,
            schemaGroups,
        };
    }

    private parseOperations(): ResolvedOperation[] {
        const paths = this.spec.paths;
        const operations: ResolvedOperation[] = [];

        Object.keys(paths).forEach(uri => {
            const pathItem: PathItem | undefined = paths[uri];
            if (!pathItem) return;

            HTTP_METHODS.forEach(method => {
                const operation = pathItem[method];
                if (!operation) return;

                operations.push(this.parseOperation(uri, method, operation));
            });
        });

        return operations;
    }

    private parseOperation(uri: string, method: HttpMethodKey, operation: Operation): ResolvedOperation {
        const {version, folder, resource, methodName} = this.naming.resolve(uri, method, operation);
        const methodPascal = StringUtil.pascalCase(methodName);
        const {pathParams, queryParams} = this.parameters.resolve(operation);
        const {hookParams, methodParams} = this.parameters.splitPathParams(uri, pathParams);

        return {
            version,
            folder,
            resource,
            methodName,
            httpMethod: method.toUpperCase() as Uppercase<HttpMethodKey>,
            pathTemplate: uri,
            hookParams,
            methodParams,
            queryParams,
            requestBody: this.requestBodies.resolve(operation, methodPascal),
            responseInner: this.responses.resolve(operation),
            cache: this.cache.resolve(method, operation, queryParams),
            docs: this.docs.resolve(operation),
        };
    }
}

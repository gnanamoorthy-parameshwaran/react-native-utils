import type TypeResolver from './TypeResolver.ts';
import type {Operation, Parameter, Reference} from '../types/OpenAPISpec.ts';
import type {ResolvedOperation, ResolvedParam, ResolvedQueryParam} from '../types/ResolvedOperation.ts';

function isReference(value: object): value is Reference {
    return '$ref' in value;
}

export default class ParameterResolver {
    constructor(protected typeResolver: TypeResolver) {}

    public resolve(operation: Operation): {pathParams: ResolvedParam[]; queryParams: ResolvedQueryParam[]} {
        const parameters = (operation.parameters ?? []).filter((param): param is Parameter => !isReference(param));

        const pathParams: ResolvedParam[] = parameters
            .filter(param => param.in === 'path')
            .map(param => ({
                name: param.name,
                type: this.typeResolver.resolve(param.schema).text,
                description: param.description,
            }));

        const queryParams: ResolvedQueryParam[] = parameters
            .filter(param => param.in === 'query')
            .map(param => ({
                name: param.name,
                type: this.typeResolver.resolve(param.schema).text,
                description: param.description,
                required: !!param.required,
            }));

        return {pathParams, queryParams};
    }

    /**
     * Splits an operation's path params into the parent-scope ones (hook-level)
     * and this resource's own id (method-level). The URI's trailing segment
     * decides it: if it's itself a `{param}`, that's the resource-specific one
     * (e.g. `{expense}` in `/expenses/{expense}`) and everything earlier is a
     * parent id (e.g. `{businessUnit}` in `/business-units/{businessUnit}/expenses`).
     * A collection URI (doesn't end in a param) has no resource-specific id at all.
     */
    public splitPathParams(uri: string, pathParams: ResolvedParam[]): {hookParams: ResolvedParam[]; methodParams: ResolvedParam[]} {
        const orderedNames = [...uri.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
        const ordered = orderedNames.map(name => pathParams.find(param => param.name === name)).filter((param): param is ResolvedParam => !!param);

        const segments = uri.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1] ?? '';
        const endsInParam = /^\{[^}]+\}$/.test(lastSegment);

        if (!endsInParam || ordered.length === 0) {
            return {hookParams: ordered, methodParams: [] as ResolvedParam[]};
        }

        return {
            hookParams: ordered.slice(0, -1),
            methodParams: ordered.slice(-1),
        };
    }

    /**
     * A sub-action endpoint (e.g. `/employees/{employee}/avatar`) doesn't end in
     * a param, so `splitPathParams` treats `employee` as a parent id -- but
     * every sibling operation in the same file (`/employees/{employee}`) treats
     * it as this resource's own id. Left alone, that produces a hook-level
     * `employee` and a method-level `employee` shadowing each other in the same
     * file. If a name is method-level anywhere in the group, promote it to
     * method-level everywhere in the group so it's consistent.
     */
    public reconcileForGroup(group: ResolvedOperation[]): ResolvedOperation[] {
        const methodLevelNames = new Set<string>();
        group.forEach(operation => operation.methodParams.forEach(param => methodLevelNames.add(param.name)));

        return group.map(operation => {
            const promoted = operation.hookParams.filter(param => methodLevelNames.has(param.name));
            if (promoted.length === 0) return operation;

            return {
                ...operation,
                hookParams: operation.hookParams.filter(param => !methodLevelNames.has(param.name)),
                methodParams: [...promoted, ...operation.methodParams],
            };
        });
    }
}

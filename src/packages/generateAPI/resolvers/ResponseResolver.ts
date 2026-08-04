import type TypeResolver from './TypeResolver.ts';
import type {ResolvedType} from './TypeResolver.ts';
import type {Operation, Reference} from '../types/OpenAPISpec.ts';

function isReference(value: object): value is Reference {
    return '$ref' in value;
}

export default class ResponseResolver {
    constructor(protected typeResolver: TypeResolver) {}

    /**
     * Resolves the success response schema as-is -- the whole body, not just its
     * `data` property. Unwrapping to `data` would drop the envelope's siblings
     * (`meta.token` on login, pagination `meta`/`links` on lists), so the response
     * type has to describe the full payload the caller actually receives.
     */
    public resolve(operation: Operation): ResolvedType {
        const responses = operation.responses;
        const success = responses['200'] ?? responses['201'] ?? responses.default;

        if (!success || isReference(success) || !success.content) {
            return {text: 'null', refs: new Set()};
        }

        const json = success.content['application/json'];
        const schema = json?.schema;
        if (!schema) return {text: 'null', refs: new Set()};

        return this.typeResolver.resolve(schema);
    }
}

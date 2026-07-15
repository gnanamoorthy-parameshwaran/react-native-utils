import type TypeResolver from './TypeResolver.ts';
import type {ResolvedType} from './TypeResolver.ts';
import type {Operation, Reference} from '../types/OpenAPISpec.ts';

function isReference(value: object): value is Reference {
    return '$ref' in value;
}

export default class ResponseResolver {
    constructor(protected typeResolver: TypeResolver) {}

    /** Resolves the `data` payload of the `{ data: T }` envelope, or the raw schema when there's no envelope. */
    public resolve(operation: Operation): ResolvedType {
        const responses = operation.responses;
        const success = responses['200'] ?? responses['201'] ?? responses.default;

        if (!success || isReference(success) || !success.content) {
            return {text: 'null', refs: new Set()};
        }

        const json = success.content['application/json'];
        const schema = json?.schema;
        if (!schema) return {text: 'null', refs: new Set()};

        if (!isReference(schema) && schema.type === 'object') {
            const dataSchema = schema.properties?.data;
            if (dataSchema) return this.typeResolver.resolve(dataSchema);
        }

        return this.typeResolver.resolve(schema);
    }
}

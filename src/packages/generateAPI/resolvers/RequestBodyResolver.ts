import type TypeResolver from './TypeResolver.ts';
import type {Operation, Reference, RequestBody} from '../types/OpenAPISpec.ts';
import type {ResolvedRequestBody} from '../types/ResolvedOperation.ts';

function isReference(value: object): value is Reference {
    return '$ref' in value;
}

function isBareIdentifier(text: string): boolean {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text);
}

export default class RequestBodyResolver {
    constructor(protected typeResolver: TypeResolver) {}

    public resolve(operation: Operation, methodPascal: string): ResolvedRequestBody | undefined {
        const requestBody: RequestBody | Reference | undefined = operation.requestBody;
        if (!requestBody || isReference(requestBody)) return undefined;

        if (requestBody.content['multipart/form-data']) {
            return {
                contentType: 'multipart/form-data',
                type: 'FormData',
                refs: new Set(),
            };
        }

        const json = requestBody.content['application/json'];
        if (!json) return undefined;

        const resolved = this.typeResolver.resolve(json.schema);
        if (isBareIdentifier(resolved.text)) {
            return {
                contentType: 'application/json',
                type: resolved.text,
                refs: resolved.refs,
            };
        }

        const name = `${methodPascal}RequestBody`;
        return {
            contentType: 'application/json',
            type: name,
            refs: resolved.refs,
            inlineType: {name, text: resolved.text},
        };
    }
}

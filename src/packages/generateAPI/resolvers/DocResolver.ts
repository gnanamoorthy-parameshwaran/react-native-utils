import type {Operation} from '../types/OpenAPISpec.ts';
import type {ResolvedDocs} from '../types/ResolvedOperation.ts';

export default class DocResolver {
    /** tag name -> its description from the spec's global `tags` list. */
    constructor(protected tagDescriptions: Map<string, string>) {}

    public resolve(operation: Operation): ResolvedDocs {
        const tag = operation.tags?.[0];
        const responses = operation.responses;
        const success = responses['200'] ?? responses['201'] ?? responses.default;

        return {
            summary: operation.summary?.trim() || undefined,
            description: operation.description?.trim() || undefined,
            deprecated: operation.deprecated,
            externalDocsUrl: operation.externalDocs?.url,
            tagDescription: tag ? this.tagDescriptions.get(tag) : undefined,
            requestBodyDescription: operation.requestBody?.description?.trim() || undefined,
            responseDescription: success?.description?.trim() || undefined,
        };
    }
}

import type {Info, Schema} from './OpenAPISpec.ts';

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
export type HttpMethodKey = (typeof HTTP_METHODS)[number];

export type ResolvedParam = {name: string; type: string; description?: string};
export type ResolvedQueryParam = ResolvedParam & {required: boolean};

export type ResolvedRequestBody = {
    contentType: 'application/json' | 'multipart/form-data';
    /** Usable type expression in generated code: a bare ref name, 'FormData', or a synthesized name. */
    type: string;
    refs: Set<string>;
    /** Set when the body schema isn't already a named type and needs to be synthesized. */
    inlineType?: {name: string; text: string};
};

export type ResolvedCache = {ttl: number};

/** Documentation carried off the spec so generated methods and hooks can be JSDoc'd. */
export type ResolvedDocs = {
    summary?: string;
    description?: string;
    deprecated?: boolean;
    externalDocsUrl?: string;
    /** From the spec's global `tags` list -- one client file groups one tag's operations, so this documents the hook itself. */
    tagDescription?: string;
    requestBodyDescription?: string;
    /** Description of the success (200/201/default) response. */
    responseDescription?: string;
};

/** One spec operation, resolved into everything a framework driver needs to emit code for it -- nothing in here is React- or Vue-specific. */
export type ResolvedOperation = {
    version: string;
    /** Client output subdirectory, e.g. "BusinessUnit" for V1.BusinessUnit.Contact.getContacts -- keeps nested Contact ops out of the same file as top-level Contact ops. Equal to `resource` when there's no real folder segment, so every client file sits at a constant depth. */
    folder: string;
    resource: string;
    methodName: string;
    httpMethod: Uppercase<HttpMethodKey>;
    pathTemplate: string;
    /** Parent-resource path params (e.g. `businessUnit` in `/business-units/{businessUnit}/expenses`) -- passed to the hook, not the method. */
    hookParams: ResolvedParam[];
    /** This resource's own id (e.g. `expense` in `/expenses/{expense}`) -- the URI's trailing path param, if any. Passed to the method, not the hook. */
    methodParams: ResolvedParam[];
    queryParams: ResolvedQueryParam[];
    requestBody?: ResolvedRequestBody;
    /** The unwrapped `data` payload type of the response (before ResponseSuccessType<T> wrapping). */
    responseInner: {text: string; refs: Set<string>};
    /** From the operation's `x-cache-config` extension. Only ever set on GET operations without query params -- caching a paginated list isn't supported yet. */
    cache?: ResolvedCache;
    docs: ResolvedDocs;
};

/** The whole spec parsed into a framework-neutral intermediate representation -- the only input a framework driver consumes. */
export type ParsedAPI = {
    info: Info;
    operations: ResolvedOperation[];
    /** All component schemas, keyed by their spec name. */
    schemas: Record<string, Schema>;
    /** schema key -> group name, e.g. BaseContactResource -> Contact. */
    schemaGroups: Map<string, string>;
};

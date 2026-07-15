import http from 'http';

/**
 * =========================================================
 * Base Utility Types
 * =========================================================
 */

export type Reference = {
    $ref: string;
    summary?: string;
    description?: string;
};

export type Extensible = {
    [key: `x-${string}`]: any;
};

/**
 * =========================================================
 * OpenAPI Root Object
 * =========================================================
 */

export type OpenAPI = Extensible & {
    openapi: string;
    info: Info;
    paths: Record<string, PathItem>;
    jsonSchemaDialect?: string;
    servers?: Server[];
    webhooks?: Record<string, PathItem>;
    components?: Components;
    security?: SecurityRequirement[];
    tags?: Tag[];
    externalDocs?: ExternalDocumentation;
};

/**
 * =========================================================
 * Info Object
 * =========================================================
 */

export type Info = Extensible & {
    title: string;
    version: string;
    summary?: string;
    description?: string;
    termsOfService?: string;
    contact?: Contact;
    license?: License;
};

export type Contact = Extensible & {
    name?: string;
    url?: string;
    email?: string;
};

export type License = Extensible & {
    name: string;
    identifier?: string;
    url?: string;
};

/**
 * =========================================================
 * Server Object
 * =========================================================
 */

export type Server = Extensible & {
    url: string;
    description?: string;
    variables?: Record<string, ServerVariable>;
};

export type ServerVariable = Extensible & {
    enum?: string[];
    default: string;
    description?: string;
};

/**
 * =========================================================
 * Paths
 * =========================================================
 */

export type PathItem = Extensible & {
    $ref?: string;
    summary?: string;
    description?: string;
    get?: Operation;
    put?: Operation;
    post?: Operation;
    delete?: Operation;
    options?: Operation;
    head?: Operation;
    patch?: Operation;
    trace?: Operation;
    servers?: Server[];
    parameters?: (Parameter | Reference)[];
};

/**
 * =========================================================
 * Operation Object
 * =========================================================
 */

export type Operation = Extensible & {
    tags?: string[];
    summary?: string;
    description?: string;
    externalDocs?: ExternalDocumentation;
    operationId?: string;
    parameters?: (Parameter | Reference)[];
    requestBody?: RequestBody | Reference;
    responses: Responses;
    callbacks?: Record<string, Callback | Reference>;
    deprecated?: boolean;
    security?: SecurityRequirement[];
    servers?: Server[];
};

/**
 * =========================================================
 * Components
 * =========================================================
 */

export type Components = Extensible & {
    schemas?: Record<string, Schema>;
    responses?: Record<string, Response | Reference>;
    parameters?: Record<string, Parameter | Reference>;
    examples?: Record<string, Example | Reference>;
    requestBodies?: Record<string, RequestBody | Reference>;
    headers?: Record<string, Header | Reference>;
    securitySchemes?: Record<string, SecurityScheme | Reference>;
    links?: Record<string, Link | Reference>;
    callbacks?: Record<string, Callback | Reference>;
    pathItems?: Record<string, PathItem>;
};

/**
 * =========================================================
 * Schema Object
 * =========================================================
 */

export type Schema = Extensible & {
    /**
     * JSON Schema Core
     */

    $id?: string;
    $schema?: string;
    $ref?: string;
    $defs?: Record<string, Schema>;
    $anchor?: string;
    $dynamicRef?: string;
    $dynamicAnchor?: string;

    /**
     * Generic Validation
     */

    type?: string | string[];
    title?: string;
    description?: string;
    default?: any;
    examples?: any[];
    const?: any;
    enum?: any[];

    /**
     * Numeric Validation
     */

    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: number;
    minimum?: number;
    exclusiveMinimum?: number;

    /**
     * String Validation
     */

    maxLength?: number;
    minLength?: number;
    pattern?: string;
    format?: string;

    /**
     * Array Validation
     */

    items?: Schema | Reference;
    prefixItems?: (Schema | Reference)[];
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    contains?: Schema | Reference;
    minContains?: number;
    maxContains?: number;

    /**
     * Object Validation
     */

    properties?: Record<string, Schema | Reference>;
    patternProperties?: Record<string, Schema | Reference>;
    additionalProperties?: boolean | Schema | Reference;
    unevaluatedProperties?: boolean | Schema | Reference;
    required?: string[];
    dependentRequired?: Record<string, string[]>;
    propertyNames?: Schema | Reference;
    minProperties?: number;
    maxProperties?: number;

    /**
     * Composition
     */

    allOf?: (Schema | Reference)[];
    anyOf?: (Schema | Reference)[];
    oneOf?: (Schema | Reference)[];
    not?: Schema | Reference;
    if?: Schema | Reference;
    then?: Schema | Reference;
    else?: Schema | Reference;

    /**
     * OpenAPI Extensions
     */

    discriminator?: Discriminator;
    xml?: XML;
    externalDocs?: ExternalDocumentation;
    example?: any;
    deprecated?: boolean;
    readOnly?: boolean;
    writeOnly?: boolean;
    nullable?: boolean;
};

/**
 * =========================================================
 * Media Type Object
 * =========================================================
 */

export type MediaType = Extensible & {
    schema?: Schema | Reference;
    example?: any;
    examples?: Record<string, Example | Reference>;
    encoding?: Record<string, Encoding>;
};

/**
 * =========================================================
 * Request Body
 * =========================================================
 */

export type RequestBody = Extensible & {
    description?: string;
    content: Record<string, MediaType>;
    required?: boolean;
};

/**
 * =========================================================
 * Response Object
 * =========================================================
 */

export type Response = Extensible & {
    description: string;
    headers?: Record<string, Header | Reference>;
    content?: Record<string, MediaType>;
    links?: Record<string, Link | Reference>;
};

export type Responses = Record<string, Response | Reference>;

/**
 * =========================================================
 * Parameter Object
 * =========================================================
 */

export type Parameter = Extensible & {
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie';
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    allowEmptyValue?: boolean;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
    schema?: Schema | Reference;
    example?: any;
    examples?: Record<string, Example | Reference>;
    content?: Record<string, MediaType>;
};

/**
 * =========================================================
 * Header Object
 * =========================================================
 */

export type Header = Omit<Parameter, 'name' | 'in'>;

/**
 * =========================================================
 * Example Object
 * =========================================================
 */

export type Example = Extensible & {
    summary?: string;
    description?: string;
    value?: any;
    externalValue?: string;
};

/**
 * =========================================================
 * Encoding Object
 * =========================================================
 */

export type Encoding = Extensible & {
    contentType?: string;
    headers?: Record<string, Header | Reference>;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
};

/**
 * =========================================================
 * Link Object
 * =========================================================
 */

export type Link = Extensible & {
    operationRef?: string;
    operationId?: string;
    parameters?: Record<string, any>;
    requestBody?: any;
    description?: string;
    server?: Server;
};

/**
 * =========================================================
 * Callback Object
 * =========================================================
 */

export type Callback = Record<string, PathItem>;

/**
 * =========================================================
 * Security
 * =========================================================
 */

export type SecurityRequirement = Record<string, string[]>;

export type SecurityScheme = Extensible & {
    type: 'apiKey' | 'http' | 'mutualTLS' | 'oauth2' | 'openIdConnect';
    description?: string;

    /**
     * apiKey
     */

    name?: string;
    in?: 'query' | 'header' | 'cookie';

    /**
     * http
     */

    scheme?: string;
    bearerFormat?: string;

    /**
     * oauth2
     */

    flows?: OAuthFlows;

    /**
     * openIdConnect
     */

    openIdConnectUrl?: string;
};

export type OAuthFlows = Extensible & {
    implicit?: OAuthFlow;
    password?: OAuthFlow;
    clientCredentials?: OAuthFlow;
    authorizationCode?: OAuthFlow;
};

export type OAuthFlow = Extensible & {
    authorizationUrl?: string;
    tokenUrl?: string;
    refreshUrl?: string;
    scopes: Record<string, string>;
};

/**
 * =========================================================
 * XML Object
 * =========================================================
 */

export type XML = Extensible & {
    name?: string;
    namespace?: string;
    prefix?: string;
    attribute?: boolean;
    wrapped?: boolean;
};

/**
 * =========================================================
 * Discriminator Object
 * =========================================================
 */

export type Discriminator = Extensible & {
    propertyName: string;
    mapping?: Record<string, string>;
};

/**
 * =========================================================
 * External Documentation
 * =========================================================
 */

export type ExternalDocumentation = Extensible & {
    url: string;
    description?: string;
};

/**
 * =========================================================
 * Tags
 * =========================================================
 */

export type Tag = Extensible & {
    name: string;
    description?: string;
    externalDocs?: ExternalDocumentation;
};

/**
 * =========================================================
 * HTTP Status Code Helpers
 * =========================================================
 */

export type HTTPStatusCode = keyof typeof http.STATUS_CODES;

/**
 * OpenAPI response keys are actually broader than Node.js
 * HTTP status codes because OpenAPI supports:
 *
 * "200"
 * "404"
 * "2XX"
 * "5XX"
 * "default"
 */
export type OpenAPIResponseKey = HTTPStatusCode | `${1 | 2 | 3 | 4 | 5}XX` | 'default';

import FileBuilder from './files.ts';
import OpenAPIParser from './parser.ts';
import TypeResolver from './typeResolver.ts';
import StringUtil from '../utils/stringUtil.ts';
import type { ClientGeneratorConfig } from '../types/Config.ts';
import type {
  Operation,
  OpenAPI,
  Parameter,
  PathItem,
  Reference,
  Schema,
} from '../types/OpenAPISpec.ts';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
type HttpMethodKey = (typeof HTTP_METHODS)[number];

const GERUNDS: Record<HttpMethodKey, string> = {
  get: 'getting',
  post: 'posting',
  put: 'putting',
  patch: 'patching',
  delete: 'deleting',
};

// Known verb prefixes a method name might start with, used to strip the verb
// off before deriving a loading-flag suffix (getAddress -> Address).
const VERB_PREFIXES = [
  'get',
  'create',
  'update',
  'delete',
  'post',
  'put',
  'patch',
  'fetch',
  'list',
  'show',
  'index',
  'store',
  'destroy',
];

// Bare Laravel-style action names that aren't descriptive enough to use as a
// method name on their own (no resource context) -- these get synthesized
// instead, e.g. "index" -> "getBankAccounts".
const GENERIC_ACTION_WORDS = new Set([
  'index',
  'store',
  'show',
  'update',
  'destroy',
  'create',
]);

const LEADING_SCHEMA_QUALIFIERS = [
  'Base',
  'Create',
  'Update',
  'Delete',
  'Store',
  'My',
];
const TRAILING_SCHEMA_QUALIFIERS = [
  'Resource',
  'Request',
  'Response',
  'List',
  'Detail',
];

type ResolvedParam = { name: string; type: string };
type ResolvedQueryParam = ResolvedParam & { required: boolean };
type ResolvedRequestBody = {
  contentType: 'application/json' | 'multipart/form-data';
  /** Usable type expression in generated code: a bare ref name, 'FormData', or a synthesized name. */
  type: string;
  refs: Set<string>;
  /** Set when the body schema isn't already a named type and needs to be synthesized. */
  inlineType?: { name: string; text: string };
};

type ResolvedCache = { ttl: number };

type ResolvedOperation = {
  version: string;
  /** Client output subdirectory, e.g. "BusinessUnit" for V1.BusinessUnit.Contact.getContacts -- keeps nested Contact ops out of the same file as top-level Contact ops. Equal to `resource` when there's no real folder segment, so every client file sits at a constant depth. */
  folder: string;
  resource: string;
  methodName: string;
  httpMethod: Uppercase<HttpMethodKey>;
  pathTemplate: string;
  pathParams: ResolvedParam[];
  queryParams: ResolvedQueryParam[];
  requestBody?: ResolvedRequestBody;
  /** The unwrapped `data` payload type of the response (before ResponseSuccessType<T> wrapping). */
  responseInner: { text: string; refs: Set<string> };
  /** From the operation's `x-cache-config` extension. Only ever set on GET operations without query params -- caching a paginated list isn't supported yet. */
  cache?: ResolvedCache;
};

type SynthesizedType = { name: string; text: string; refs: Set<string> };
type SchemaGroup = { schemaKeys: string[]; synthesized: SynthesizedType[] };

function isReference(value: object): value is Reference {
  return '$ref' in value;
}

function isBareIdentifier(text: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text);
}

/** Strips Base/Create/Update/.../Resource/Request/Response/List/Detail qualifiers to find the shared resource name behind a schema, e.g. BaseContactResource & UpdateContactRequest -> "Contact". */
function schemaGroupName(name: string): string {
  let result = name;

  for (const prefix of LEADING_SCHEMA_QUALIFIERS) {
    if (result.startsWith(prefix) && result.length > prefix.length) {
      result = result.slice(prefix.length);
      break;
    }
  }

  let strippedTrailing = true;
  while (strippedTrailing) {
    strippedTrailing = false;
    for (const suffix of TRAILING_SCHEMA_QUALIFIERS) {
      if (result.endsWith(suffix) && result.length > suffix.length) {
        result = result.slice(0, -suffix.length);
        strippedTrailing = true;
        break;
      }
    }
  }

  return result || name;
}

class APIClientGenerator {
  protected spec: OpenAPI;
  protected config: ClientGeneratorConfig;
  protected parser: OpenAPIParser;
  protected fileBuilder: FileBuilder;
  protected typeResolver: TypeResolver;
  /** schema key -> group name, e.g. BaseContactResource -> Contact */
  protected schemaGroups = new Map<string, string>();

  constructor(spec: OpenAPI, config: ClientGeneratorConfig) {
    this.spec = spec;
    this.config = config;
    this.parser = new OpenAPIParser(spec);
    this.fileBuilder = new FileBuilder(config.rootDir);
    this.typeResolver = new TypeResolver();
  }

  public generate() {
    const schemas = this.parser.getComponents()?.schemas ?? {};
    Object.keys(schemas).forEach((key) =>
      this.schemaGroups.set(key, schemaGroupName(key))
    );

    this.writeSharedTypes();
    const operations = this.resolveOperations();
    this.writeTypeFiles(operations, schemas);
    this.writeClientFiles(operations);
  }

  private writeSharedTypes() {
    this.fileBuilder.createFile({
      name: 'index.ts',
      content: `export type ResponseSuccessType<T> = { data: T };\n`,
      directory: this.config.outputDir,
    });
  }

  private resolveOperations(): ResolvedOperation[] {
    const paths = this.parser.getPaths();
    const operations: ResolvedOperation[] = [];

    Object.keys(paths).forEach((uri) => {
      const pathItem: PathItem | undefined = paths[uri];
      if (!pathItem) return;

      HTTP_METHODS.forEach((method) => {
        const operation = pathItem[method];
        if (!operation) return;

        operations.push(this.resolveOperation(uri, method, operation));
      });
    });

    return operations;
  }

  private resolveOperation(
    uri: string,
    method: HttpMethodKey,
    operation: Operation
  ): ResolvedOperation {
    const { version, folder, resource, methodName } = this.resolveNaming(
      uri,
      method,
      operation
    );
    const methodPascal = StringUtil.pascalCase(methodName);
    const { pathParams, queryParams } = this.resolveParameters(operation);

    return {
      version,
      folder,
      resource,
      methodName,
      httpMethod: method.toUpperCase() as Uppercase<HttpMethodKey>,
      pathTemplate: uri,
      pathParams,
      queryParams,
      requestBody: this.resolveRequestBody(operation, methodPascal),
      responseInner: this.resolveResponseInner(operation),
      cache: this.resolveCache(method, operation, queryParams),
    };
  }

  /**
   * Reads the `x-cache-config` vendor extension (e.g. `{ "ttl": 300 }`, seconds)
   * to decide whether a generated GET should carry a cacheConfig + invalidate
   * helper. Only applies to GETs with no query params -- caching a paginated
   * list isn't supported yet, so it's deliberately ignored there for now.
   */
  private resolveCache(
    method: HttpMethodKey,
    operation: Operation,
    queryParams: ResolvedQueryParam[]
  ): ResolvedCache | undefined {
    if (method !== 'get' || queryParams.length > 0) return undefined;

    const raw = operation['x-cache-config'];
    const ttl = typeof raw === 'object' && raw ? Number(raw.ttl) : NaN;
    return Number.isFinite(ttl) ? { ttl } : undefined;
  }

  /**
   * Prefers the `Version.Resource.Resource.method` operationId convention.
   * Falls back to `tags` + the URL path for operationIds that don't follow it,
   * or that only give a generic Laravel action name (index/store/show/...).
   */
  private resolveNaming(
    uri: string,
    method: HttpMethodKey,
    operation: Operation
  ): { version: string; folder: string; resource: string; methodName: string } {
    const idParts = (operation.operationId ?? '').split('.').filter(Boolean);
    const pathSegments = uri.split('/').filter(Boolean);
    const versionSegment = pathSegments.find((segment) =>
      /^v\d+$/i.test(segment)
    );

    if (idParts.length >= 4) {
      const versionPart = idParts[0] ?? 'Api';
      const folderPart = idParts[1] ?? 'Root';
      const filePart = idParts[2] ?? folderPart;
      const methodPart = idParts[3];
      const resource = StringUtil.pascalCase(filePart);
      return {
        version: StringUtil.pascalCase(versionPart),
        // Nested routes (e.g. V1.BusinessUnit.Contact.getContacts) share a file
        // name with an unrelated top-level resource (V1.Contact.Contact.getContact) --
        // the folder subdirectory keeps them apart. Every client file lives 3
        // levels below outputDir (clients/version/folder) so import depth stays
        // constant regardless of whether folder happens to equal resource.
        folder: StringUtil.pascalCase(folderPart),
        resource,
        methodName:
          methodPart ??
          this.synthesizeMethodName(method, pathSegments, filePart),
      };
    }

    const version = versionSegment ? versionSegment.toUpperCase() : 'Api';
    const tag = operation.tags?.[0];
    const resourceSegment = pathSegments.find(
      (segment) => !segment.startsWith('{') && segment !== versionSegment
    );
    const resource = StringUtil.pascalCase(tag ?? resourceSegment ?? 'Root');
    const idLast = idParts[idParts.length - 1];
    const methodName =
      idLast && !GENERIC_ACTION_WORDS.has(idLast.toLowerCase())
        ? idLast
        : this.synthesizeMethodName(method, pathSegments, resource);

    return { version, folder: resource, resource, methodName };
  }

  /** Canonical verb+resource method name for operationIds that don't already give a descriptive one. */
  private synthesizeMethodName(
    method: HttpMethodKey,
    pathSegments: string[],
    resource: string
  ): string {
    const lastSegment = pathSegments[pathSegments.length - 1] ?? '';
    const isCollection = !lastSegment.startsWith('{');

    switch (method) {
      case 'get':
        return isCollection ? `get${resource}s` : `get${resource}`;
      case 'post':
        return `create${resource}`;
      case 'put':
      case 'patch':
        return `update${resource}`;
      case 'delete':
        return `delete${resource}`;
    }
  }

  /** verb-gerund + the part of the method name that disambiguates it, e.g. getAddress -> gettingAddress. */
  private loadingSuffix(methodName: string): string {
    for (const verb of VERB_PREFIXES) {
      if (
        methodName.toLowerCase().startsWith(verb) &&
        methodName.length > verb.length
      ) {
        const rest = methodName.slice(verb.length);
        if (/^[A-Z]/.test(rest)) return rest;
      }
    }
    return StringUtil.pascalCase(methodName);
  }

  private resolveParameters(operation: Operation) {
    const parameters = (operation.parameters ?? []).filter(
      (param): param is Parameter => !isReference(param)
    );

    const pathParams: ResolvedParam[] = parameters
      .filter((param) => param.in === 'path')
      .map((param) => ({
        name: param.name,
        type: this.typeResolver.resolve(param.schema).text,
      }));

    const queryParams: ResolvedQueryParam[] = parameters
      .filter((param) => param.in === 'query')
      .map((param) => ({
        name: param.name,
        type: this.typeResolver.resolve(param.schema).text,
        required: !!param.required,
      }));

    return { pathParams, queryParams };
  }

  private resolveRequestBody(
    operation: Operation,
    methodPascal: string
  ): ResolvedRequestBody | undefined {
    const requestBody = operation.requestBody;
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
      inlineType: { name, text: resolved.text },
    };
  }

  /** Resolves the `data` payload of the `{ data: T }` envelope, or the raw schema when there's no envelope. */
  private resolveResponseInner(operation: Operation): {
    text: string;
    refs: Set<string>;
  } {
    const responses = operation.responses;
    const success = responses['200'] ?? responses['201'] ?? responses.default;

    if (!success || isReference(success) || !success.content) {
      return { text: 'null', refs: new Set() };
    }

    const json = success.content['application/json'];
    const schema = json?.schema;
    if (!schema) return { text: 'null', refs: new Set() };

    if (!isReference(schema) && schema.type === 'object') {
      const dataSchema = schema.properties?.data;
      if (dataSchema) return this.typeResolver.resolve(dataSchema);
    }

    return this.typeResolver.resolve(schema);
  }

  private writeTypeFiles(
    operations: ResolvedOperation[],
    schemas: Record<string, Schema>
  ) {
    const groups = new Map<string, SchemaGroup>();
    const getGroup = (name: string): SchemaGroup => {
      let group = groups.get(name);
      if (!group) {
        group = { schemaKeys: [], synthesized: [] };
        groups.set(name, group);
      }
      return group;
    };

    this.schemaGroups.forEach((groupName, schemaKey) => {
      getGroup(groupName).schemaKeys.push(schemaKey);
    });

    operations.forEach((operation) => {
      const group = getGroup(operation.resource);
      const responseName = `${StringUtil.pascalCase(operation.methodName)}Response`;
      this.addSynthesized(group, {
        name: responseName,
        text: `ResponseSuccessType<${operation.responseInner.text}>`,
        refs: operation.responseInner.refs,
      });

      if (operation.requestBody?.inlineType) {
        this.addSynthesized(group, {
          name: operation.requestBody.inlineType.name,
          text: operation.requestBody.inlineType.text,
          refs: operation.requestBody.refs,
        });
      }
    });

    groups.forEach((group, groupName) =>
      this.writeTypeFile(groupName, group, schemas)
    );
  }

  /** Two operations (e.g. a top-level and a nested route) can synthesize the same name for the same resource -- dedupe identical ones, otherwise disambiguate so neither declaration is lost. */
  private addSynthesized(group: SchemaGroup, entry: SynthesizedType) {
    const existing = group.synthesized.find((item) => item.name === entry.name);
    if (!existing) {
      group.synthesized.push(entry);
      return;
    }
    if (existing.text === entry.text) return;

    let suffix = 2;
    while (
      group.synthesized.some((item) => item.name === `${entry.name}${suffix}`)
    ) {
      suffix += 1;
    }
    group.synthesized.push({ ...entry, name: `${entry.name}${suffix}` });
  }

  private writeTypeFile(
    groupName: string,
    group: SchemaGroup,
    schemas: Record<string, Schema>
  ) {
    const ownKeys = new Set(group.schemaKeys);
    const refs = new Set<string>();
    const bodyParts: string[] = [];
    let usesResponseWrapper = false;

    group.schemaKeys.forEach((key) => {
      const schema = schemas[key];
      if (!schema) return;

      const { statements, refs: memberRefs } =
        this.typeResolver.resolveMembers(schema);
      memberRefs.forEach((ref) => refs.add(ref));
      const body = statements.length
        ? `{ ${statements.join(' ')} }`
        : 'Record<string, unknown>';
      bodyParts.push(`export type ${key} = ${body};`);
    });

    group.synthesized.forEach((entry) => {
      entry.refs.forEach((ref) => refs.add(ref));
      if (entry.text.startsWith('ResponseSuccessType<'))
        usesResponseWrapper = true;
      bodyParts.push(`export type ${entry.name} = ${entry.text};`);
    });

    const importsByGroup = new Map<string, Set<string>>();
    refs.forEach((ref) => {
      if (ownKeys.has(ref)) return;
      const targetGroup = this.schemaGroups.get(ref);
      if (!targetGroup || targetGroup === groupName) return;
      const names = importsByGroup.get(targetGroup) ?? new Set<string>();
      names.add(ref);
      importsByGroup.set(targetGroup, names);
    });

    const importLines: string[] = [];
    if (usesResponseWrapper) {
      importLines.push(`import type { ResponseSuccessType } from '..';`);
    }
    importsByGroup.forEach((names, targetGroup) => {
      importLines.push(
        `import type { ${[...names].join(', ')} } from './${targetGroup}';`
      );
    });

    const content = `${importLines.length ? `${importLines.join('\n')}\n\n` : ''}${bodyParts.join('\n\n')}\n`;

    this.fileBuilder.createFile({
      name: `${groupName}.ts`,
      content,
      directory: `${this.config.outputDir}/types`,
    });
  }

  private writeClientFiles(operations: ResolvedOperation[]) {
    const groups = new Map<string, ResolvedOperation[]>();

    operations.forEach((operation) => {
      const key = `${operation.version}::${operation.folder}::${operation.resource}`;
      const group = groups.get(key) ?? [];
      group.push(operation);
      groups.set(key, group);
    });

    groups.forEach((group) => this.writeClientFile(group));
  }

  private writeClientFile(group: ResolvedOperation[]) {
    const first = group[0];
    if (!first) return;

    const importsByGroup = new Map<string, Set<string>>();
    const hookLines: string[] = [];
    const callbackCodes: string[] = [];
    const returnItems: string[] = [];
    let usesCache = false;

    group.forEach((operation) => {
      const built = this.buildMethod(operation);
      built.typeRefs.forEach(({ name, group: owningGroup }) => {
        const names = importsByGroup.get(owningGroup) ?? new Set<string>();
        names.add(name);
        importsByGroup.set(owningGroup, names);
      });
      hookLines.push(built.hookLine);
      callbackCodes.push(built.callbackCode);
      returnItems.push(built.loadingName, ...built.methodNames);
      usesCache = usesCache || built.usesCache;
    });

    const typeImportLines: string[] = [];
    importsByGroup.forEach((names, groupName) => {
      typeImportLines.push(
        `import type { ${[...names].join(', ')} } from '../../../types/${groupName}';`
      );
    });

    const header = [
      `import React from 'react';`,
      `import useAPI from '${this.config.useAPIImportPath}';`,
      ...(usesCache
        ? [`import { getCacheKey } from '@gnanamoorthy/react-native-utils';`]
        : []),
      ...typeImportLines,
    ].join('\n');

    const content = `${header}\n\nexport default function use${first.resource}() {\n${hookLines.join('\n')}\n\n${callbackCodes.join('\n\n')}\n\n    return { ${returnItems.join(', ')} };\n}\n`;

    this.fileBuilder.createFile({
      name: `use${first.resource}.ts`,
      content,
      directory: `${this.config.outputDir}/clients/${first.version}/${first.folder}`,
    });
  }

  private buildMethod(operation: ResolvedOperation) {
    const args: string[] = [];

    operation.pathParams.forEach((param) =>
      args.push(`${param.name}: ${param.type}`)
    );

    let requestBodyLine = '';
    if (operation.requestBody) {
      args.push(`body: ${operation.requestBody.type}`);
      requestBodyLine =
        operation.requestBody.contentType === 'application/json'
          ? `            body: JSON.stringify(body),\n            headers: new Headers({ 'Content-Type': 'application/json' }),`
          : `            body,`;
    }

    const hasQuery = operation.queryParams.length > 0;
    if (hasQuery) {
      const queryRequired = operation.queryParams.some(
        (param) => param.required
      );
      const shape = operation.queryParams
        .map(
          (param) => `${param.name}${param.required ? '' : '?'}: ${param.type}`
        )
        .join(' ');
      args.push(`params${queryRequired ? '' : '?'}: { ${shape} }`);
    }

    const methodPascal = StringUtil.pascalCase(operation.methodName);
    const responseTypeName = `${methodPascal}Response`;
    const endpoint = operation.pathTemplate.replace(
      /\{([^}]+)\}/g,
      (_match, name: string) => '${' + name + '}'
    );
    const requestName = `${operation.methodName}Request`;
    const httpMethodKey = operation.httpMethod.toLowerCase() as HttpMethodKey;
    // Strips the leading verb the same way loading names do, so the public
    // invalidate method reads as invalidateProducts/invalidateProduct rather
    // than invalidateGetProducts.
    const invalidateSuffix = this.loadingSuffix(operation.methodName);
    const loadingName = `${GERUNDS[httpMethodKey]}${invalidateSuffix}`;
    const invalidateName = `invalidate${invalidateSuffix}Cache`;
    const cacheKeyExpr = `getCacheKey('GET', \`${endpoint}\`)`;

    const hookLine = operation.cache
      ? `    const { loading: ${loadingName}, request: ${requestName}, invalidateCache: ${invalidateName} } = useAPI();`
      : `    const { loading: ${loadingName}, request: ${requestName} } = useAPI();`;

    const lines: string[] = [];
    lines.push(
      `    const ${operation.methodName} = React.useCallback((${args.join(', ')}) => {`
    );
    if (hasQuery) {
      lines.push(
        `        const query = params ? \`?\${new URLSearchParams(params as Record<string, string>).toString()}\` : '';`
      );
    }
    lines.push(`        return ${requestName}<${responseTypeName}>({`);
    lines.push(
      `            method: '${operation.httpMethod}',`,
      `            endpoint: \`${endpoint}${hasQuery ? '${query}' : ''}\`,`
    );
    if (requestBodyLine) lines.push(requestBodyLine);
    if (operation.cache) {
      lines.push(
        `            cacheConfig: { ttl: ${operation.cache.ttl}, key: ${cacheKeyExpr} },`
      );
    }
    lines.push(`        });`);
    lines.push(`    }, [${requestName}]);`);

    if (operation.cache) {
      // `cache` is only ever set for GETs with no query params, so `args`
      // here is guaranteed to be just the path params -- enough to recompute
      // the same cache key the getter used.
      lines.push('');
      lines.push(
        `    const invalidate${invalidateSuffix} = React.useCallback((${args.join(', ')}) => {`
      );
      lines.push(`        return ${invalidateName}(${cacheKeyExpr});`);
      lines.push(`    }, [${invalidateName}]);`);
    }

    const typeRefs: { name: string; group: string }[] = [
      { name: responseTypeName, group: operation.resource },
    ];
    if (operation.requestBody && operation.requestBody.type !== 'FormData') {
      const bodyType = operation.requestBody.type;
      const bodyGroup = operation.requestBody.inlineType
        ? operation.resource
        : this.schemaGroups.get(bodyType);
      if (bodyGroup) typeRefs.push({ name: bodyType, group: bodyGroup });
    }

    const methodNames = operation.cache
      ? [operation.methodName, `invalidate${invalidateSuffix}`]
      : [operation.methodName];

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

export default APIClientGenerator;

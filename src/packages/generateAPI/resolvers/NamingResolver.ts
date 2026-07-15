import StringUtil from '../support/StringUtil.ts';
import type {Operation} from '../types/OpenAPISpec.ts';
import type {HttpMethodKey} from '../types/ResolvedOperation.ts';

const GERUNDS: Record<HttpMethodKey, string> = {
    get: 'getting',
    post: 'posting',
    put: 'putting',
    patch: 'patching',
    delete: 'deleting',
};

// Known verb prefixes a method name might start with, used to strip the verb
// off before deriving a loading-flag suffix (getAddress -> Address).
const VERB_PREFIXES = ['get', 'create', 'update', 'delete', 'post', 'put', 'patch', 'fetch', 'list', 'show', 'index', 'store', 'destroy'];

// Bare Laravel-style action names that aren't descriptive enough to use as a
// method name on their own (no resource context) -- these get synthesized
// instead, e.g. "index" -> "getBankAccounts".
const GENERIC_ACTION_WORDS = new Set(['index', 'store', 'show', 'update', 'destroy', 'create']);

const LEADING_SCHEMA_QUALIFIERS = ['Base', 'Create', 'Update', 'Delete', 'Store', 'My'];
const TRAILING_SCHEMA_QUALIFIERS = ['Resource', 'Request', 'Response', 'List', 'Detail'];

export type ResolvedNaming = {version: string; folder: string; resource: string; methodName: string};

export default class NamingResolver {
    /**
     * Prefers the `Version.Resource.Resource.method` operationId convention.
     * Falls back to `tags` + the URL path for operationIds that don't follow it,
     * or that only give a generic Laravel action name (index/store/show/...).
     */
    public resolve(uri: string, method: HttpMethodKey, operation: Operation): ResolvedNaming {
        const idParts = (operation.operationId ?? '').split('.').filter(Boolean);
        const pathSegments = uri.split('/').filter(Boolean);
        const versionSegment = pathSegments.find(segment => /^v\d+$/i.test(segment));

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
                // the folder subdirectory keeps them apart. Every client file lives at
                // clientOutputDir/version/folder, a constant depth, regardless of
                // whether folder happens to equal resource.
                folder: StringUtil.pascalCase(folderPart),
                resource,
                methodName: methodPart ?? this.synthesizeMethodName(method, pathSegments, filePart),
            };
        }

        const version = versionSegment ? versionSegment.toUpperCase() : 'Api';
        const tag = operation.tags?.[0];
        const resourceSegment = pathSegments.find(segment => !segment.startsWith('{') && segment !== versionSegment);
        const resource = StringUtil.pascalCase(tag ?? resourceSegment ?? 'Root');
        const idLast = idParts[idParts.length - 1];
        const methodName =
            idLast && !GENERIC_ACTION_WORDS.has(idLast.toLowerCase()) ? idLast : this.synthesizeMethodName(method, pathSegments, resource);

        return {version, folder: resource, resource, methodName};
    }

    /** Canonical verb+resource method name for operationIds that don't already give a descriptive one. */
    private synthesizeMethodName(method: HttpMethodKey, pathSegments: string[], resource: string): string {
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
    public loadingSuffix(methodName: string): string {
        for (const verb of VERB_PREFIXES) {
            if (methodName.toLowerCase().startsWith(verb) && methodName.length > verb.length) {
                const rest = methodName.slice(verb.length);
                if (/^[A-Z]/.test(rest)) return rest;
            }
        }
        return StringUtil.pascalCase(methodName);
    }

    /** Loading-flag name for an operation, e.g. GET getAddress -> gettingAddress. */
    public loadingName(method: HttpMethodKey, methodName: string): string {
        return `${GERUNDS[method]}${this.loadingSuffix(methodName)}`;
    }

    /** Strips Base/Create/Update/.../Resource/Request/Response/List/Detail qualifiers to find the shared resource name behind a schema, e.g. BaseContactResource & UpdateContactRequest -> "Contact". */
    public schemaGroupName(name: string): string {
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
}

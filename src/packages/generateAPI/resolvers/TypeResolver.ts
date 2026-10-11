import DocUtil from '../support/DocUtil.ts';
import type {Reference, Schema} from '../types/OpenAPISpec.ts';

const PRIMITIVE_MAP: Record<string, string> = {
    integer: 'number',
    number: 'number',
    string: 'string',
    boolean: 'boolean',
    null: 'null',
};

export type ResolvedType = {
    text: string;
    refs: Set<string>;
};

function isReference(schema: Schema | Reference): schema is Reference {
    return typeof (schema as Reference).$ref === 'string';
}

function refName(ref: string): string {
    return ref.split('/').pop() ?? ref;
}

/** A TS literal for an enum/const value; strings are single-quoted with `\` and `'` escaped. */
function literal(value: unknown): string {
    return typeof value === 'string' ? `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'` : String(value);
}

/**
 * True when a type expression has a top-level `|` or `&`, i.e. one outside any
 * braces, brackets, parentheses, angle brackets or string literal. Such a type
 * needs parentheses before `[]`: `(A | B)[]`, not `A | B[]`.
 */
function hasTopLevelOperator(text: string): boolean {
    let depth = 0;
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (char === '\\') i++;
            else if (char === "'") quoted = false;
        } else if (char === "'") quoted = true;
        else if ('{[(<'.includes(char!)) depth++;
        else if ('}])>'.includes(char!)) depth--;
        else if (depth === 0 && (char === '|' || char === '&')) return true;
    }

    return false;
}

export default class TypeResolver {
    /** Component schemas by name, used to check which properties an `allOf` member makes required. */
    constructor(protected schemas: Record<string, Schema | Reference> = {}) {}

    public resolve(schema?: Schema | Reference): ResolvedType {
        if (!schema) return {text: 'unknown', refs: new Set()};

        if (isReference(schema)) {
            const name = refName(schema.$ref);
            return {text: name, refs: new Set([name])};
        }

        if (schema.allOf) {
            return this.withNullable(schema, this.resolveIntersection(schema.allOf));
        }

        if (schema.anyOf || schema.oneOf) {
            return this.resolveUnion(schema, schema.anyOf ?? schema.oneOf ?? []);
        }

        if (schema.const !== undefined) {
            return this.withNullable(schema, {text: literal(schema.const), refs: new Set()});
        }

        if (schema.enum) {
            const text = schema.enum.map(literal).join(' | ');
            return this.withNullable(schema, {text, refs: new Set()});
        }

        if (Array.isArray(schema.type)) {
            return this.resolveTypeList(schema, schema.type);
        }

        if (schema.type === 'array') {
            const item = this.resolve(schema.items);
            const itemText = hasTopLevelOperator(item.text) ? `(${item.text})` : item.text;
            return this.withNullable(schema, {
                text: `${itemText}[]`,
                refs: item.refs,
            });
        }

        if (schema.type === 'object' || schema.properties) {
            return this.withNullable(schema, this.resolveObject(schema));
        }

        const primitive = schema.type && PRIMITIVE_MAP[schema.type];
        if (primitive) {
            return this.withNullable(schema, {text: primitive, refs: new Set()});
        }

        return {text: 'unknown', refs: new Set()};
    }

    /**
     * The type of a named component schema. Object schemas keep their member
     * list (and their `Record<string, unknown>` fallback when they declare no
     * properties); anything else, e.g. a string enum, resolves like an inline schema.
     */
    public resolveNamed(schema: Schema | Reference): ResolvedType {
        if (isReference(schema) || !this.isObjectSchema(schema)) return this.resolve(schema);
        return this.resolveObject(schema);
    }

    /** Property declarations for an object schema, one per line — used for named interfaces. */
    public resolveMembers(schema: Schema): {
        statements: string[];
        refs: Set<string>;
    } {
        const properties = schema.properties ?? {};
        const required = schema.required ?? [];
        const refs = new Set<string>();

        const statements = Object.keys(properties).map(key => {
            const property = properties[key];
            const resolved = this.resolve(property);
            resolved.refs.forEach(ref => refs.add(ref));
            const optional = required.includes(key) ? '' : '?';
            const doc = this.memberDoc(property);
            return `${doc}${key}${optional}: ${resolved.text};`;
        });

        return {statements, refs};
    }

    /** Inline JSDoc for an object property, built from the schema's documentation fields; '' when the schema gives nothing to say. */
    private memberDoc(schema?: Schema | Reference): string {
        if (!schema) return '';

        if (isReference(schema)) {
            const text = schema.description ?? schema.summary;
            return text ? `${DocUtil.inline(text)} ` : '';
        }

        const parts: string[] = [];
        const summary = schema.description ?? schema.title;
        if (summary) parts.push(summary);
        if (schema.format) parts.push(`Format: \`${schema.format}\`.`);
        if (schema.default !== undefined) parts.push(`@default ${JSON.stringify(schema.default)}`);
        if (schema.deprecated) parts.push('@deprecated');

        return parts.length ? `${DocUtil.inline(parts.join(' '))} ` : '';
    }

    private isObjectSchema(schema: Schema): boolean {
        return !schema.allOf && !schema.anyOf && !schema.oneOf && !schema.enum && (schema.type === 'object' || !!schema.properties);
    }

    /**
     * An object's members. With no `properties` but an `additionalProperties`
     * schema it is a map, `Record<string, T>`; with neither it stays
     * `Record<string, unknown>`.
     */
    private resolveObject(schema: Schema): ResolvedType {
        const {statements, refs} = this.resolveMembers(schema);
        if (statements.length > 0) return {text: `{ ${statements.join(' ')} }`, refs};

        const extra = schema.additionalProperties;
        if (extra && typeof extra === 'object') {
            const value = this.resolve(extra);
            return {text: `Record<string, ${value.text}>`, refs: value.refs};
        }

        return {text: 'Record<string, unknown>', refs};
    }

    /**
     * `allOf` as an intersection of its members. A member that only lists
     * `required` keys (common in Laravel/Scramble specs) doesn't add a type of its
     * own: it makes those keys required on the referenced members that declare
     * them as optional, e.g. `Customer & Required<Pick<Customer, 'phone'>>`.
     * Keys a referenced schema doesn't declare, or already requires, are left out,
     * and a single remaining member is returned as is.
     */
    private resolveIntersection(members: (Schema | Reference)[]): ResolvedType {
        const isRequiredOnly = (member: Schema | Reference) =>
            !isReference(member) && !!member.required?.length && !member.properties && !member.allOf && !member.anyOf && !member.oneOf;

        const extraRequired = members.filter(isRequiredOnly).flatMap(member => (member as Schema).required ?? []);
        const refs = new Set<string>();
        const parts: string[] = [];

        members
            .filter(member => !isRequiredOnly(member))
            .forEach(member => {
                const resolved = this.resolve(member);
                resolved.refs.forEach(ref => refs.add(ref));
                parts.push(hasTopLevelOperator(resolved.text) ? `(${resolved.text})` : resolved.text);

                const keys = isReference(member) ? this.optionalKeys(refName(member.$ref), extraRequired) : [];
                if (keys.length) parts.push(`Required<Pick<${resolved.text}, ${keys.map(literal).join(' | ')}>>`);
            });

        return {text: parts.join(' & ') || 'unknown', refs};
    }

    /** The given keys that the named schema declares as properties but doesn't already require. */
    private optionalKeys(schemaName: string, keys: string[]): string[] {
        const schema = this.schemas[schemaName];
        if (!schema || isReference(schema)) return [];

        const properties = schema.properties ?? {};
        const required = schema.required ?? [];
        return [...new Set(keys)].filter(key => key in properties && !required.includes(key));
    }

    /** An OpenAPI 3.1 type list such as `["string", "null"]` or `["array", "null"]`, as a union of each type. */
    private resolveTypeList(schema: Schema, types: string[]): ResolvedType {
        const refs = new Set<string>();
        const text = types
            .map(type => {
                if (PRIMITIVE_MAP[type]) return PRIMITIVE_MAP[type];
                const resolved = this.resolve({...schema, type: type as Schema['type']});
                resolved.refs.forEach(ref => refs.add(ref));
                return resolved.text;
            })
            .join(' | ');
        return {text, refs};
    }

    private resolveUnion(schema: Schema, members: (Schema | Reference)[]): ResolvedType {
        const refs = new Set<string>();
        const parts = members.map(member => {
            const resolved = this.resolve(member);
            resolved.refs.forEach(ref => refs.add(ref));
            return resolved.text;
        });
        return this.withNullable(schema, {
            text: parts.join(' | ') || 'unknown',
            refs,
        });
    }

    private withNullable(schema: Schema, resolved: ResolvedType): ResolvedType {
        return schema.nullable ? {text: `${resolved.text} | null`, refs: resolved.refs} : resolved;
    }
}

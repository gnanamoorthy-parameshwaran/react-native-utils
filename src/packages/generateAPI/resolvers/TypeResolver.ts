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

export default class TypeResolver {
    public resolve(schema?: Schema | Reference): ResolvedType {
        if (!schema) return {text: 'unknown', refs: new Set()};

        if (isReference(schema)) {
            const name = refName(schema.$ref);
            return {text: name, refs: new Set([name])};
        }

        if (schema.anyOf || schema.oneOf) {
            return this.resolveUnion(schema, schema.anyOf ?? schema.oneOf ?? []);
        }

        if (schema.enum) {
            const text = schema.enum.map(value => (typeof value === 'string' ? `'${value}'` : String(value))).join(' | ');
            return this.withNullable(schema, {text, refs: new Set()});
        }

        if (Array.isArray(schema.type)) {
            const text = schema.type.map(type => PRIMITIVE_MAP[type] ?? 'unknown').join(' | ');
            return {text, refs: new Set()};
        }

        if (schema.type === 'array') {
            const item = this.resolve(schema.items);
            return this.withNullable(schema, {
                text: `${item.text}[]`,
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

    private resolveObject(schema: Schema): ResolvedType {
        const {statements, refs} = this.resolveMembers(schema);
        const text = statements.length > 0 ? `{ ${statements.join(' ')} }` : 'Record<string, unknown>';
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

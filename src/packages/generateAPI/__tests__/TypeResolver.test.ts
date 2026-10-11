import TypeResolver from '../resolvers/TypeResolver.ts';
import type {Schema} from '../types/OpenAPISpec.ts';

/** Component schemas the `allOf` cases reference, shaped like Laravel/Scramble resources. */
const schemas: Record<string, Schema> = {
    BaseCustomerResource: {
        type: 'object',
        properties: {id: {type: 'integer'}, name: {type: 'string'}, phone: {type: ['string', 'null']}},
        required: ['id', 'name'],
    },
    DocumentResource: {
        type: 'object',
        properties: {id: {type: 'integer'}, owner: {type: 'string'}, entity: {type: 'string'}},
        required: ['id'],
    },
};

const resolver = new TypeResolver(schemas);
const text = (schema: Schema) => resolver.resolve(schema).text;

describe('TypeResolver', () => {
    describe('allOf', () => {
        it('makes the keys of a required-only member required on the referenced schema', () => {
            const resolved = resolver.resolve({
                allOf: [{$ref: '#/components/schemas/BaseCustomerResource'}, {type: 'object', required: ['phone']}],
            });

            expect(resolved.text).toBe("BaseCustomerResource & Required<Pick<BaseCustomerResource, 'phone'>>");
            expect([...resolved.refs]).toEqual(['BaseCustomerResource']);
        });

        it('wraps the intersection in parentheses inside an array (the spec example)', () => {
            expect(
                text({
                    type: 'array',
                    items: {allOf: [{$ref: '#/components/schemas/BaseCustomerResource'}, {type: 'object', required: ['phone']}]},
                }),
            ).toBe("(BaseCustomerResource & Required<Pick<BaseCustomerResource, 'phone'>>)[]");
        });

        it('lists several newly required keys in one Pick', () => {
            expect(text({allOf: [{$ref: '#/components/schemas/DocumentResource'}, {type: 'object', required: ['owner', 'entity']}]})).toBe(
                "DocumentResource & Required<Pick<DocumentResource, 'owner' | 'entity'>>",
            );
        });

        it('drops required keys the referenced schema already requires or does not declare', () => {
            expect(text({allOf: [{$ref: '#/components/schemas/BaseCustomerResource'}, {type: 'object', required: ['id', 'missing']}]})).toBe(
                'BaseCustomerResource',
            );
        });

        it('intersects $ref and inline object members', () => {
            expect(
                text({
                    allOf: [
                        {$ref: '#/components/schemas/DocumentResource'},
                        {type: 'object', properties: {url: {type: 'string'}}, required: ['url']},
                    ],
                }),
            ).toBe('DocumentResource & { url: string; }');
        });

        it('parenthesizes union members of an intersection', () => {
            expect(text({allOf: [{anyOf: [{type: 'string'}, {type: 'integer'}]}, {type: 'object', properties: {a: {type: 'string'}}}]})).toBe(
                '(string | number) & { a?: string; }',
            );
        });
    });

    it('resolves const to a literal type', () => {
        expect(text({type: 'string', const: 'Prompt stored successfully'})).toBe("'Prompt stored successfully'");
        expect(text({const: 3})).toBe('3');
    });

    it('escapes quotes and backslashes in string literals', () => {
        expect(text({enum: ["it's", 'a\\b']})).toBe("'it\\'s' | 'a\\\\b'");
    });

    it('keeps null in enums', () => {
        expect(text({enum: ['open', null]})).toBe("'open' | null");
    });

    it('types an object with only additionalProperties as a map', () => {
        expect(
            text({
                type: 'object',
                additionalProperties: {type: 'object', properties: {date: {type: 'string'}, count: {type: 'integer'}}, required: ['date', 'count']},
            }),
        ).toBe('Record<string, { date: string; count: number; }>');
        expect(text({type: 'object'})).toBe('Record<string, unknown>');
    });

    it('resolves OpenAPI 3.1 type lists, including non-primitive members', () => {
        expect(text({type: ['string', 'null']})).toBe('string | null');
        expect(text({type: ['array', 'null'], items: {type: 'integer'}})).toBe('number[] | null');
    });

    it('parenthesizes union array items but not object items with nullable members', () => {
        expect(text({type: 'array', items: {anyOf: [{$ref: '#/components/schemas/DocumentResource'}, {type: 'null'}]}})).toBe(
            '(DocumentResource | null)[]',
        );
        expect(text({type: 'array', items: {type: 'object', properties: {a: {type: ['string', 'null']}}}})).toBe('{ a?: string | null; }[]');
    });

    describe('resolveNamed', () => {
        it('resolves a named enum schema to its values instead of an empty object', () => {
            expect(resolver.resolveNamed({type: 'string', enum: ['pending', 'completed']}).text).toBe("'pending' | 'completed'");
            expect(resolver.resolveNamed({type: 'integer', enum: [1, 2, 3, 4]}).text).toBe('1 | 2 | 3 | 4');
        });

        it('keeps the member list for named object schemas', () => {
            expect(resolver.resolveNamed(schemas.BaseCustomerResource!).text).toBe('{ id: number; name: string; phone?: string | null; }');
        });
    });
});

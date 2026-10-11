import OperationParser from '../parsers/OperationParser.ts';
import TypeFileGenerator from '../generators/TypeFileGenerator.ts';
import type {OpenAPI} from '../types/OpenAPISpec.ts';
import type {ClientGeneratorConfig} from '../types/Config.ts';

/**
 * Runs a small spec through the real parser and type file generator, covering
 * named non-object schemas, `allOf` responses and responses without a JSON body.
 */
const spec = {
    openapi: '3.1.0',
    info: {title: 'Test', version: '1.0.0'},
    components: {
        schemas: {
            OrderStatus: {type: 'string', enum: ['pending', 'completed'], title: 'OrderStatus'},
            OrderResource: {
                type: 'object',
                properties: {
                    id: {type: 'integer'},
                    status: {$ref: '#/components/schemas/OrderStatus'},
                    items: {type: 'array', items: {type: 'string'}},
                },
                required: ['id', 'status'],
            },
        },
    },
    paths: {
        '/v1/orders/{order}': {
            get: {
                operationId: 'V1.Order.Order.getOrder',
                parameters: [{name: 'order', in: 'path', required: true, schema: {type: 'integer'}}],
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: {allOf: [{$ref: '#/components/schemas/OrderResource'}, {type: 'object', required: ['items']}]},
                                    },
                                    required: ['data'],
                                },
                            },
                        },
                    },
                },
            },
            delete: {
                operationId: 'V1.Order.Order.deleteOrder',
                parameters: [{name: 'order', in: 'path', required: true, schema: {type: 'integer'}}],
                responses: {204: {description: 'No content'}},
            },
        },
        '/v1/orders/{order}/receipt': {
            get: {
                operationId: 'V1.Order.Order.getOrderReceipt',
                parameters: [{name: 'order', in: 'path', required: true, schema: {type: 'integer'}}],
                responses: {200: {description: 'HTML receipt', content: {'text/html': {schema: {type: 'string'}}}}},
            },
        },
    },
} as unknown as OpenAPI;

const config: ClientGeneratorConfig = {
    specUrl: 'http://example.invalid/spec.json',
    useAPIImportPath: '../../../../hooks/useAPI',
    clientOutputDir: 'src/generated/clients',
    typeOutputDir: 'src/generated/types',
    rootDir: '/tmp/type-generation-test',
};

const files = new TypeFileGenerator(new OperationParser(spec).parse(), config).generate();
const fileContent = (name: string) => files.find(file => file.name === name)?.content ?? '';

describe('generated type files', () => {
    it('emits a named enum schema as a union of its values', () => {
        expect(fileContent('OrderStatus.ts')).toContain("export type OrderStatus = 'pending' | 'completed';");
    });

    it('resolves an allOf response to the referenced resource with the extra required keys', () => {
        expect(fileContent('Order.ts')).toContain(
            "export type GetOrderResponse = { data: OrderResource & Required<Pick<OrderResource, 'items'>>; };",
        );
    });

    it('types a 204 response as undefined, matching what the runtime returns', () => {
        expect(fileContent('Order.ts')).toContain('export type DeleteOrderResponse = undefined;');
    });

    it('types a non-JSON response from its own schema', () => {
        expect(fileContent('Order.ts')).toContain('export type GetOrderReceiptResponse = string;');
    });
});

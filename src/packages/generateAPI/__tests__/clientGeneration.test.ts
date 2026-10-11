import OperationParser from '../parsers/OperationParser.ts';
import ReactClientGenerator from '../generators/frameworks/ReactClientGenerator.ts';
import type {OpenAPI} from '../types/OpenAPISpec.ts';
import type {ClientGeneratorConfig} from '../types/Config.ts';

/**
 * End-to-end check that the generator emits API clients only: a spec carrying
 * `x-cache-config` and a paginated response still produces plain `useAPI`
 * request methods, with caching left to page-level `useQuery`.
 */
const spec: OpenAPI = {
    openapi: '3.1.0',
    info: {title: 'Test', version: '1.0.0'},
    paths: {
        '/v1/business-units': {
            get: {
                'operationId': 'V1.BusinessUnit.BusinessUnit.getBusinessUnits',
                'responses': {
                    200: {
                        description: 'Paginated',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: {type: 'array', items: {type: 'object'}},
                                        meta: {
                                            type: 'object',
                                            properties: {current_page: {type: 'integer'}, last_page: {type: 'integer'}},
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                'parameters': [{name: 'page', in: 'query', required: false, schema: {type: 'integer'}}],
                'x-cache-config': {ttl: 300000, tags: ['business-units']},
            },
        },
        '/v1/business-units/{businessUnit}': {
            get: {
                'operationId': 'V1.BusinessUnit.BusinessUnit.getBusinessUnit',
                'responses': {},
                'parameters': [{name: 'businessUnit', in: 'path', required: true, schema: {type: 'integer'}}],
                'x-cache-config': {ttl: 300000, tags: ['business-units']},
            },
        },
        '/v1/business-units/{businessUnit}/goals': {
            get: {
                operationId: 'V1.BusinessUnit.BusinessUnit.getGoals',
                responses: {},
                parameters: [{name: 'businessUnit', in: 'path', required: true, schema: {type: 'integer'}}],
            },
        },
    },
} as unknown as OpenAPI;

const config: ClientGeneratorConfig = {
    specUrl: 'http://example.invalid/spec.json',
    useAPIImportPath: '../../../../hooks/useAPI',
    clientOutputDir: 'src/generated/clients',
    typeOutputDir: 'src/generated/types',
    rootDir: '/tmp/cache-generation-test',
};

function generateBusinessUnitFile(): string {
    const parsed = new OperationParser(spec).parse();
    const files = new ReactClientGenerator(parsed, config).generate();
    const file = files.find(f => f.name === 'useBusinessUnit.ts');
    if (!file) throw new Error('Expected a useBusinessUnit.ts file to be generated.');
    return file.content;
}

describe('generated clients stay free of caching', () => {
    const content = generateBusinessUnitFile();

    it('imports only the default useAPI hook', () => {
        expect(content).toContain("import useAPI from '../../../../hooks/useAPI';");
        expect(content).not.toContain('@gnanamoorthy/react-native-utils');
    });

    it('ignores x-cache-config: no query hooks, invalidate helpers or cache options', () => {
        for (const term of ['useQuery', 'useInfiniteQuery', 'queryClient', 'invalidate', 'cacheConfig']) {
            expect(content).not.toContain(term);
        }
    });

    it('emits plain request methods with query params folded into the endpoint', () => {
        expect(content).toMatch(/const getBusinessUnits = React\.useCallback/);
        expect(content).toContain('endpoint: `/v1/business-units${query}`,');
        expect(content).toMatch(/return \{ gettingBusinessUnits, getBusinessUnits, gettingBusinessUnit, getBusinessUnit, gettingGoals, getGoals \};/);
    });
});

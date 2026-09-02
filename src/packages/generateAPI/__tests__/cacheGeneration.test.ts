import OperationParser from '../parsers/OperationParser.ts';
import ReactClientGenerator from '../generators/frameworks/ReactClientGenerator.ts';
import type {OpenAPI} from '../types/OpenAPISpec.ts';
import type {ClientGeneratorConfig} from '../types/Config.ts';

/**
 * End-to-end coverage for the pagination-caching + tag-based group invalidation
 * work: a minimal spec goes through the real OperationParser -> ReactClientGenerator
 * pipeline (the same one `generate-client` runs), and the emitted file content is
 * asserted directly, so this fails if the resolver and the generator ever disagree
 * about the cache key/tag contract between them.
 */
const spec: OpenAPI = {
    openapi: '3.1.0',
    info: {title: 'Test', version: '1.0.0'},
    paths: {
        '/v1/business-units': {
            get: {
                'operationId': 'V1.BusinessUnit.BusinessUnit.getBusinessUnits',
                'responses': {},
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
                // No x-cache-config at all -- this operation must stay uncached and
                // must not pull the tag-index useAPI() call in on its own.
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

describe('generated cache key + tag-group invalidation wiring', () => {
    const content = generateBusinessUnitFile();

    it("folds the query string into the paginated list GET's cache key", () => {
        expect(content).toMatch(/getBusinessUnits = React\.useCallback/);
        // The cache key expression must reuse the same `${query}` the request itself
        // sends, not just the bare path -- otherwise every page would collide on one key.
        expect(content).toContain('endpoint: `/v1/business-units${query}`');
    });

    it("carries the declared tags into the paginated list GET's cacheConfig", () => {
        expect(content).toMatch(/cacheConfig: \{ ttl: 300000, key: getCacheKey\(\{[\s\S]*?tags: \["business-units"\]/);
    });

    it("carries the same tags into the detail GET's cacheConfig", () => {
        // This fixture has no update/delete op on the resource, so "getGoals ="
        // (the next operation emitted after the detail GET) is the real end
        // boundary -- not some op that doesn't exist in the generated file.
        const detailBlock = content.slice(content.indexOf('getBusinessUnit ='), content.indexOf('getGoals ='));
        expect(detailBlock).toContain('tags: ["business-units"]');
    });

    it('emits exactly one deduplicated invalidateBusinessUnitsGroup helper, not one per operation', () => {
        const matches = content.match(/const invalidateBusinessUnitsGroup = React\.useCallback/g) ?? [];
        expect(matches).toHaveLength(1);
        expect(content).toContain("return invalidateCacheGroup('business-units');");
    });

    it('exports the group-invalidate helper from the hook', () => {
        expect(content).toMatch(/return \{[\s\S]*invalidateBusinessUnitsGroup[\s\S]*\};/);
    });

    it('leaves the untagged operation uncached, with no per-operation invalidate helper', () => {
        expect(content).not.toMatch(/invalidateGoals\b/);
        const goalsBlock = content.slice(content.indexOf('getGoals ='));
        expect(goalsBlock).not.toContain('cacheConfig');
    });

    describe("the paginated list's own invalidate helper", () => {
        const listInvalidateBlock = content.slice(
            content.indexOf('const invalidateBusinessUnits = React.useCallback'),
            content.indexOf('const getBusinessUnit ='),
        );

        it('clears the whole tagged group as well as the exact key, since one page-specific key would leave other pages stale', () => {
            expect(listInvalidateBlock).toContain('return Promise.all([');
            expect(listInvalidateBlock).toContain('invalidateBusinessUnitsCache(');
            expect(listInvalidateBlock).toContain("invalidateCacheGroup('business-units'),");
        });

        it('lists invalidateCacheGroup in its useCallback deps', () => {
            expect(listInvalidateBlock).toContain('}, [invalidateBusinessUnitsCache, invalidateCacheGroup]);');
        });
    });

    it('leaves a tagged but NON-paginated GET clearing only its exact key -- no group clear needed when the key already covers everything stale for it', () => {
        const detailInvalidateBlock = content.slice(
            content.indexOf('const invalidateBusinessUnit = React.useCallback'),
            content.indexOf('getGoals ='),
        );

        expect(detailInvalidateBlock).toContain('return invalidateBusinessUnitCache(');
        expect(detailInvalidateBlock).not.toContain('invalidateCacheGroup');
        expect(detailInvalidateBlock).not.toContain('Promise.all');
    });
});

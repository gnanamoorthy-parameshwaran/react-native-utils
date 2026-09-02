import CacheResolver from '../resolvers/CacheResolver.ts';
import type {Operation} from '../types/OpenAPISpec.ts';

const operation = (extra: Record<string, unknown> = {}): Operation => ({responses: {}, ...extra}) as Operation;

describe('CacheResolver', () => {
    const resolver = new CacheResolver();

    it('returns undefined when the operation has no x-cache-config', () => {
        expect(resolver.resolve('get', operation())).toBeUndefined();
    });

    it('returns undefined for non-GET methods even with x-cache-config present', () => {
        const op = operation({'x-cache-config': {ttl: 1000}});
        expect(resolver.resolve('post', op)).toBeUndefined();
        expect(resolver.resolve('put', op)).toBeUndefined();
        expect(resolver.resolve('patch', op)).toBeUndefined();
        expect(resolver.resolve('delete', op)).toBeUndefined();
    });

    it('resolves a bare ttl with no tags', () => {
        const op = operation({'x-cache-config': {ttl: 300000}});
        expect(resolver.resolve('get', op)).toEqual({ttl: 300000});
    });

    it('now applies to GET operations regardless of query params -- pagination is no longer excluded', () => {
        // CacheResolver no longer takes a queryParams argument at all; the guard that
        // used to disable caching on any GET with query params is gone.
        const op = operation({'x-cache-config': {ttl: 300000}});
        expect(resolver.resolve('get', op)).toEqual({ttl: 300000});
    });

    it('resolves tags alongside ttl', () => {
        const op = operation({'x-cache-config': {ttl: 300000, tags: ['business-units']}});
        expect(resolver.resolve('get', op)).toEqual({ttl: 300000, tags: ['business-units']});
    });

    it('resolves multiple tags', () => {
        const op = operation({'x-cache-config': {ttl: 300000, tags: ['business-units', 'goals']}});
        expect(resolver.resolve('get', op)).toEqual({ttl: 300000, tags: ['business-units', 'goals']});
    });

    it('drops an empty tags array rather than returning tags: []', () => {
        const op = operation({'x-cache-config': {ttl: 300000, tags: []}});
        expect(resolver.resolve('get', op)).toEqual({ttl: 300000});
    });

    it('filters out non-string entries from tags', () => {
        const op = operation({'x-cache-config': {ttl: 300000, tags: ['ok', 42, null, 'also-ok']}});
        expect(resolver.resolve('get', op)).toEqual({ttl: 300000, tags: ['ok', 'also-ok']});
    });

    it('ignores a malformed x-cache-config (not an object)', () => {
        expect(resolver.resolve('get', operation({'x-cache-config': 'nope'}))).toBeUndefined();
        expect(resolver.resolve('get', operation({'x-cache-config': null}))).toBeUndefined();
    });

    it('returns undefined when ttl is missing or not a finite number', () => {
        expect(resolver.resolve('get', operation({'x-cache-config': {}}))).toBeUndefined();
        expect(resolver.resolve('get', operation({'x-cache-config': {ttl: 'soon'}}))).toBeUndefined();
        expect(resolver.resolve('get', operation({'x-cache-config': {ttl: Infinity}}))).toBeUndefined();
    });

    it('coerces a numeric-string ttl', () => {
        const op = operation({'x-cache-config': {ttl: '300000'}});
        expect(resolver.resolve('get', op)).toEqual({ttl: 300000});
    });
});

import {getCacheKey} from '../util';

describe('getCacheKey', () => {
    it('defaults the method to GET and needs no query', () => {
        expect(getCacheKey({method: undefined, endpoint: '/v1/things'})).toBe('GET:/v1/things');
    });

    it('builds a plain method:endpoint key when there is no query', () => {
        expect(getCacheKey({method: 'GET', endpoint: '/v1/business-units'})).toBe('GET:/v1/business-units');
    });

    it('treats an empty query object the same as no query', () => {
        expect(getCacheKey({method: 'GET', endpoint: '/v1/business-units', query: {}})).toBe('GET:/v1/business-units');
    });

    it('appends a single query param', () => {
        expect(getCacheKey({method: 'GET', endpoint: '/v1/business-units', query: {page: '2'}})).toBe('GET:/v1/business-units?page=2');
    });

    it('sorts query params by key so param insertion order never changes the key', () => {
        const a = getCacheKey({method: 'GET', endpoint: '/v1/things', query: {page: '2', per_page: '15'}});
        const b = getCacheKey({method: 'GET', endpoint: '/v1/things', query: {per_page: '15', page: '2'}});

        expect(a).toBe(b);
        expect(a).toBe('GET:/v1/things?page=2&per_page=15');
    });

    it('keys distinct pages of the same paginated endpoint differently', () => {
        const page1 = getCacheKey({method: 'GET', endpoint: '/v1/business-units', query: {page: '1'}});
        const page2 = getCacheKey({method: 'GET', endpoint: '/v1/business-units', query: {page: '2'}});

        expect(page1).not.toBe(page2);
    });
});

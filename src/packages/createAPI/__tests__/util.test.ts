import {hashKey, matchKey} from '../util';

describe('hashKey', () => {
    it('ignores object key order', () => {
        expect(hashKey(['posts', {page: 1, sort: 'asc'}])).toBe(hashKey(['posts', {sort: 'asc', page: 1}]));
    });

    it('keeps array order significant', () => {
        expect(hashKey(['a', 'b'])).not.toBe(hashKey(['b', 'a']));
    });
});

describe('matchKey', () => {
    it('matches by prefix', () => {
        expect(matchKey(['posts', {page: 2}], ['posts'])).toBe(true);
        expect(matchKey(['users'], ['posts'])).toBe(false);
    });

    it('matches object segments partially', () => {
        expect(matchKey(['posts', {userId: 1, page: 2}], ['posts', {userId: 1}])).toBe(true);
        expect(matchKey(['posts', {userId: 2, page: 2}], ['posts', {userId: 1}])).toBe(false);
    });
});

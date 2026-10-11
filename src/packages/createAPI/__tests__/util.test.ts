import {hashKey, matchKey, replaceEqualDeep} from '../util';

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

describe('replaceEqualDeep', () => {
    it('returns the previous reference when the new value is deep-equal', () => {
        const previous = {list: [{id: 1}, {id: 2}], meta: {page: 1}};
        expect(replaceEqualDeep(previous, JSON.parse(JSON.stringify(previous)))).toBe(previous);
    });

    it('reuses unchanged parts and replaces changed ones', () => {
        const previous = {list: [{id: 1}, {id: 2, title: 'a'}], meta: {page: 1}};
        const next = replaceEqualDeep(previous, {list: [{id: 1}, {id: 2, title: 'b'}], meta: {page: 1}});

        expect(next).not.toBe(previous);
        expect(next.meta).toBe(previous.meta);
        expect(next.list[0]).toBe(previous.list[0]);
        expect(next.list[1]).toEqual({id: 2, title: 'b'});
    });

    it('treats added or removed keys and items as a change', () => {
        expect(replaceEqualDeep({a: 1, b: 2}, {a: 1})).toEqual({a: 1});
        expect(replaceEqualDeep([1, 2], [1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('compares anything other than plain objects and arrays by identity', () => {
        const date = new Date(0);
        expect(replaceEqualDeep(new Date(0), date)).toBe(date);
        expect(replaceEqualDeep(undefined, 'value')).toBe('value');
    });
});

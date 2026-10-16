import ArrayUtils from '../utils/ArrayUtils';

describe('ArrayUtils (Laravel Arr port)', () => {
    const data = {products: {desk: {price: 100}}};

    it('get / set / fill / forget / has use dot paths without mutating', () => {
        expect(ArrayUtils.get({object: data, path: 'products.desk.price'})).toBe(100);
        expect(ArrayUtils.get({object: data, path: 'products.desk.discount', defaultValue: 0})).toBe(0);
        expect(ArrayUtils.set({object: data, path: 'products.desk.price', value: 200})).toEqual({products: {desk: {price: 200}}});
        expect(ArrayUtils.fill({object: data, path: 'products.desk.price', value: 200})).toEqual(data);
        expect(ArrayUtils.fill<any>({object: data, path: 'products.desk.discount', value: 10}).products.desk.discount).toBe(10);
        expect(ArrayUtils.forget({object: data, paths: 'products.desk'})).toEqual({products: {}});
        expect(data.products.desk.price).toBe(100);
        expect(ArrayUtils.has({object: data, paths: ['products.desk.price', 'products.desk.discount']})).toBe(false);
        expect(ArrayUtils.hasAny({object: data, paths: ['x', 'products.desk']})).toBe(true);
    });

    it('supports wildcards and {first}/{last}', () => {
        const items = {products: [{name: 'Desk 1', price: 100}, {name: 'Desk 2'}]};
        expect(ArrayUtils.get({object: items, path: 'products.*.name'})).toEqual(['Desk 1', 'Desk 2']);
        expect(ArrayUtils.get({object: items, path: 'products.{last}.name'})).toBe('Desk 2');
        expect(ArrayUtils.fill({object: items as Record<string, any>, path: 'products.*.price', value: 200}).products[1]?.price).toBe(200);
        expect(ArrayUtils.forget({object: items, paths: 'products.*.name'}).products[0]).toEqual({price: 100});
    });

    it('typed getters throw on mismatch', () => {
        const object = {name: 'Joe', age: 42};
        expect(ArrayUtils.string({object, path: 'name'})).toBe('Joe');
        expect(() => ArrayUtils.integer({object, path: 'name'})).toThrow(TypeError);
    });

    it('dot / undot round trip', () => {
        const flat = ArrayUtils.dot({object: data});
        expect(flat).toEqual({'products.desk.price': 100});
        expect(ArrayUtils.undot(flat)).toEqual(data);
    });

    it('list helpers', () => {
        expect(ArrayUtils.collapse([[1, 2], [3], null])).toEqual([1, 2, 3]);
        expect(
            ArrayUtils.crossJoin([
                [1, 2],
                ['a', 'b'],
            ]),
        ).toEqual([
            [1, 'a'],
            [1, 'b'],
            [2, 'a'],
            [2, 'b'],
        ]);
        expect(ArrayUtils.partition({array: [1, 2, 3, 4], callback: i => i < 3})).toEqual([
            [1, 2],
            [3, 4],
        ]);
        expect(ArrayUtils.take({array: [0, 1, 2, 3], count: -2})).toEqual([2, 3]);
        expect(ArrayUtils.join({array: ['a', 'b', 'c'], glue: ', ', finalGlue: ', and '})).toBe('a, b, and c');
        expect(ArrayUtils.first({array: [100, 200, 300], callback: v => v >= 150})).toBe(200);
        expect(ArrayUtils.last({array: [100, 200, 300, 110], callback: v => v >= 150})).toBe(300);
        expect(ArrayUtils.first({array: [], defaultValue: 'none'})).toBe('none');
        expect(() => ArrayUtils.sole({array: [1, 2], callback: () => true})).toThrow();
        expect(ArrayUtils.wrap(null)).toEqual([]);
        expect(ArrayUtils.exceptValues({array: [1, '1', 2, '2'], values: [1, 2], strict: true})).toEqual(['1', '2']);
        expect(ArrayUtils.onlyValues({array: ['foo', 'bar', 'baz'], values: ['foo', 'baz']})).toEqual(['foo', 'baz']);
    });

    it('collection helpers', () => {
        const rows = [
            {id: 1, name: 'Desk', dev: {name: 'Taylor'}},
            {id: 2, name: 'Chair', dev: {name: 'Abigail'}},
        ];
        expect(ArrayUtils.pluck({array: rows, value: 'dev.name'})).toEqual(['Taylor', 'Abigail']);
        expect(ArrayUtils.pluck({array: rows, value: 'dev.name', key: 'id'})).toEqual({1: 'Taylor', 2: 'Abigail'});
        expect(ArrayUtils.keyBy({array: rows, key: 'name'}).Chair?.id).toBe(2);
        expect(ArrayUtils.select({array: rows, keys: ['name']})).toEqual([{name: 'Desk'}, {name: 'Chair'}]);
        expect(ArrayUtils.sort({array: rows, callback: r => r.name})[0]?.name).toBe('Chair');
        expect(ArrayUtils.sortDesc({array: ['Desk', 'Table', 'Chair']})).toEqual(['Table', 'Desk', 'Chair']);
        expect(ArrayUtils.sortRecursive({value: {b: [3, 1], a: 1}})).toEqual({a: 1, b: [1, 3]});
        expect(
            ArrayUtils.mapSpread({
                array: [
                    [0, 1],
                    [2, 3],
                ] as [number, number][],
                callback: (a, b) => a + b,
            }),
        ).toEqual([1, 5]);
    });

    it('query and css classes', () => {
        expect(decodeURIComponent(ArrayUtils.query({name: 'Taylor', order: {column: 'created_at', direction: 'desc'}}))).toBe(
            'name=Taylor&order[column]=created_at&order[direction]=desc',
        );
        expect(ArrayUtils.toCssClasses(['p-4', {'font-bold': false, 'bg-red': true}])).toBe('p-4 bg-red');
    });
});

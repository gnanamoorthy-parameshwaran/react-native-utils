type Obj = Record<string, any>;
type Path = string | number;

const MISSING = Symbol('missing');

const isContainer = (value: unknown): value is Obj => typeof value === 'object' && value !== null;
const hasKey = (target: Obj, key: string) => Object.prototype.hasOwnProperty.call(target, key);
const toSegments = (path: Path) => String(path).split('.');
const compare = (a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0);
const looseEquals = (a: unknown, b: unknown) => a === b || String(a) === String(b);

/**
 * Path helpers behind get/set/fill/forget/has. They never mutate their input and understand the
 * Laravel `data_*` extras: `*` visits every child, `{first}` and `{last}` pick the edge child.
 */
const resolveKey = ({target, segment}: {target: Obj; segment: string}) => {
    if (segment !== '{first}' && segment !== '{last}') {
        return segment;
    }

    const keys = Object.keys(target);
    return (segment === '{first}' ? keys[0] : keys[keys.length - 1]) ?? segment;
};

const getIn = ({target, segments, defaultValue}: {target: unknown; segments: string[]; defaultValue: unknown}): unknown => {
    const [head, ...rest] = segments;

    if (head === undefined) {
        return target;
    }

    if (!isContainer(target)) {
        return defaultValue;
    }

    if (head === '*') {
        const items: unknown[] = Array.isArray(target) ? target : Object.values(target);
        const mapped = items.map(item => getIn({target: item, segments: rest, defaultValue}));
        return rest.includes('*') ? mapped.flat() : mapped;
    }

    const key = resolveKey({target, segment: head});
    return hasKey(target, key) ? getIn({target: target[key], segments: rest, defaultValue}) : defaultValue;
};

const setIn = ({target, segments, value, overwrite}: {target: unknown; segments: string[]; value: unknown; overwrite: boolean}): unknown => {
    const [head, ...rest] = segments;

    if (head === undefined) {
        return value;
    }

    if (head === '*') {
        const visit = (item: unknown) => (rest.length ? setIn({target: item, segments: rest, value, overwrite}) : overwrite ? value : item);

        if (Array.isArray(target)) {
            return target.map(visit);
        }

        return isContainer(target) ? Object.fromEntries(Object.entries(target).map(([key, item]) => [key, visit(item)])) : target;
    }

    const copy: Obj = Array.isArray(target) ? [...target] : isContainer(target) ? {...target} : {};
    const key = resolveKey({target: copy, segment: head});
    const exists = hasKey(copy, key);

    if (rest.length === 0) {
        if (overwrite || !exists) {
            copy[key] = value;
        }
    } else {
        copy[key] = setIn({target: exists ? copy[key] : undefined, segments: rest, value, overwrite});
    }

    return copy;
};

const forgetIn = ({target, segments}: {target: unknown; segments: string[]}): unknown => {
    const [head, ...rest] = segments;

    if (head === undefined || !isContainer(target)) {
        return target;
    }

    if (head === '*') {
        if (rest.length === 0) {
            return Array.isArray(target) ? [] : {};
        }

        if (Array.isArray(target)) {
            return target.map(item => forgetIn({target: item, segments: rest}));
        }

        return Object.fromEntries(Object.entries(target).map(([key, item]) => [key, forgetIn({target: item, segments: rest})]));
    }

    const key = resolveKey({target, segment: head});

    if (!hasKey(target, key)) {
        return target;
    }

    if (rest.length === 0) {
        return Array.isArray(target)
            ? target.filter((_, index) => String(index) !== key)
            : Object.fromEntries(Object.entries(target).filter(([name]) => name !== key));
    }

    const copy: Obj = Array.isArray(target) ? [...target] : {...target};
    copy[key] = forgetIn({target: copy[key], segments: rest});
    return copy;
};

const getTyped = <R>({object, path, label, check}: {object: unknown; path: Path; label: string; check: (value: unknown) => value is R}): R => {
    const value = getIn({target: object, segments: toSegments(path), defaultValue: undefined});

    if (!check(value)) {
        throw new TypeError(`Value at "${path}" must be ${label}.`);
    }

    return value;
};

/**
 * Port of Laravel's `Arr` helpers. Every method returns a new value and leaves its input untouched,
 * and "dot" paths (`'products.desk.price'`) work on both objects and arrays. Methods that JavaScript
 * already covers well (`map`, `filter`) and PHP-only ones (`accessible`, `isList`) are left out.
 */
class ArrayUtils {
    /**
     * Group an array of objects by a specific property.
     * @param array The array to group.
     * @param property The property to group by.
     * @returns An object where the keys are the property values, and the values are arrays of objects with that property.
     */
    static groupBy<T extends Record<string, any>>(array: T[], property: string): Record<string, T[]> {
        const getValue = (obj: any, path: string) => path.split('.').reduce((acc, key) => acc?.[key], obj);

        return array.reduce(
            (result, item) => {
                const key = getValue(item, property);

                if (!result[key]) {
                    result[key] = [];
                }

                result[key].push(item);
                return result;
            },
            {} as Record<string, T[]>,
        );
    }

    /**
     * Remove duplicates from an array.
     * @param array The array to remove duplicates from.
     * @returns A new array with unique values.
     */
    static removeDuplicates<T>(array: T[]): T[] {
        return Array.from(new Set(array));
    }

    /**
     * Find the intersection of two arrays.
     * @param array1 The first array.
     * @param array2 The second array.
     * @returns An array containing elements present in both arrays.
     */
    static intersection<T>(array1: T[], array2: T[]): T[] {
        return array1.filter(item => array2.includes(item));
    }

    /**
     * Flatten a multi-dimensional array into a single-dimensional array.
     * @param array The multi-dimensional array.
     * @returns A flattened array.
     */
    static flatten<T>(array: T[][]): T[] {
        return array.reduce((flat, current) => flat.concat(current), []);
    }

    /**
     * Shuffle an array.
     * @param array The array to shuffle.
     * @returns A new array with the elements shuffled.
     */
    static shuffle<T>(array: T[]): T[] {
        return array
            .map(value => ({value, sortKey: Math.random()}))
            .sort((a, b) => a.sortKey - b.sortKey)
            .map(({value}) => value);
    }

    static groupByDate<T extends Record<string, any>>(
        items: T[],
        dateField: keyof T,
        options?: {
            order?: 'asc' | 'desc';
            useFormattedDate?: boolean;
            locale?: string;
            dateOptions?: Intl.DateTimeFormatOptions;
        },
    ): {title: string; data: T[]}[] {
        const {
            order = 'asc',
            useFormattedDate = false,
            locale = 'en-US',
            dateOptions = {year: 'numeric', month: 'short', day: 'numeric'},
        } = options || {};

        const formatter = new Intl.DateTimeFormat(locale, dateOptions);

        const sorted = [...items].sort((a, b) => {
            const aTime = new Date(a[dateField] as string).getTime();
            const bTime = new Date(b[dateField] as string).getTime();
            return order === 'asc' ? aTime - bTime : bTime - aTime;
        });

        const grouped = sorted.reduce(
            (acc, item) => {
                const dateObj = new Date(item[dateField] as string);
                const dateKey = (useFormattedDate ? formatter.format(dateObj) : dateObj.toISOString().split('T')[0]) as string;

                if (!acc[dateKey]) {
                    acc[dateKey] = [];
                }
                acc[dateKey]?.push(item);
                return acc;
            },
            {} as Record<string, T[]>,
        );

        return Object.entries(grouped).map(([title, data]) => ({title, data}));
    }

    /**
     * Read a value by "dot" path, returning `defaultValue` when any segment is missing. Supports
     * `*` wildcards and `{first}` / `{last}`. A flat key that itself contains dots wins over a path.
     */
    static get<R = any>({object, path, defaultValue}: {object: unknown; path: Path; defaultValue?: R}): R {
        if (isContainer(object) && hasKey(object, String(path))) {
            return object[String(path)];
        }

        return getIn({target: object, segments: toSegments(path), defaultValue}) as R;
    }

    /** Return a copy of `object` with `value` written at the "dot" path, creating missing levels. */
    static set<T = any>({object, path, value}: {object: T; path: Path; value: unknown}): T {
        return setIn({target: object, segments: toSegments(path), value, overwrite: true}) as T;
    }

    /** Like `set`, but keeps any value that already exists at the path. */
    static fill<T = any>({object, path, value}: {object: T; path: Path; value: unknown}): T {
        return setIn({target: object, segments: toSegments(path), value, overwrite: false}) as T;
    }

    /** Return a copy of `object` without the given "dot" path(s). Removed array items shift down. */
    static forget<T = any>({object, paths}: {object: T; paths: Path | Path[]}): T {
        return [paths].flat().reduce<unknown>((result, path) => forgetIn({target: result, segments: toSegments(path)}), object) as T;
    }

    /** True when every given "dot" path exists. */
    static has({object, paths}: {object: unknown; paths: Path | Path[]}): boolean {
        const list = [paths].flat();
        return list.length > 0 && list.every(path => getIn({target: object, segments: toSegments(path), defaultValue: MISSING}) !== MISSING);
    }

    static hasAll({object, paths}: {object: unknown; paths: Path[]}): boolean {
        return ArrayUtils.has({object, paths});
    }

    static hasAny({object, paths}: {object: unknown; paths: Path | Path[]}): boolean {
        return [paths].flat().some(path => ArrayUtils.has({object, paths: path}));
    }

    /** Own-key check, for objects and array indexes. */
    static exists({object, key}: {object: Obj; key: Path}): boolean {
        return hasKey(object, String(key));
    }

    /** Add a key only when it is missing or `null`. */
    static add<T extends Obj>({object, path, value}: {object: T; path: Path; value: unknown}): T {
        return ArrayUtils.get({object, path}) == null ? ArrayUtils.set({object, path, value}) : object;
    }

    /** The typed getters read like `get` but throw a `TypeError` when the value has another type. */
    static string({object, path}: {object: unknown; path: Path}): string {
        return getTyped({object, path, label: 'a string', check: (value): value is string => typeof value === 'string'});
    }

    static integer({object, path}: {object: unknown; path: Path}): number {
        return getTyped({object, path, label: 'an integer', check: (value): value is number => Number.isInteger(value)});
    }

    static float({object, path}: {object: unknown; path: Path}): number {
        return getTyped({object, path, label: 'a number', check: (value): value is number => typeof value === 'number' && !Number.isNaN(value)});
    }

    static boolean({object, path}: {object: unknown; path: Path}): boolean {
        return getTyped({object, path, label: 'a boolean', check: (value): value is boolean => typeof value === 'boolean'});
    }

    static array<R = unknown>({object, path}: {object: unknown; path: Path}): R[] {
        return getTyped({object, path, label: 'an array', check: (value): value is R[] => Array.isArray(value)});
    }

    /** Push an item onto the array at the "dot" path, creating the array when it does not exist. */
    static push<T = any>({object, path, value}: {object: T; path: Path; value: unknown}): T {
        const current = ArrayUtils.get({object, path});
        return ArrayUtils.set({object, path, value: [...(Array.isArray(current) ? current : []), value]});
    }

    static only<T extends Obj>({object, keys}: {object: T; keys: string[]}): Partial<T> {
        return Object.fromEntries(Object.entries(object).filter(([key]) => keys.includes(key))) as Partial<T>;
    }

    static except<T extends Obj>({object, keys}: {object: T; keys: string[]}): Partial<T> {
        return Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key))) as Partial<T>;
    }

    /** Values are compared as strings unless `strict` is set, which mirrors PHP's loose `==`. */
    static onlyValues<T>({array, values, strict = false}: {array: T[]; values: unknown[]; strict?: boolean}): T[] {
        const equals = strict ? Object.is : looseEquals;
        return array.filter(item => values.some(value => equals(item, value)));
    }

    static exceptValues<T>({array, values, strict = false}: {array: T[]; values: unknown[]; strict?: boolean}): T[] {
        const equals = strict ? Object.is : looseEquals;
        return array.filter(item => !values.some(value => equals(item, value)));
    }

    /** Pick `keys` (dot paths allowed) from every item. */
    static select<T extends Obj>({array, keys}: {array: T[]; keys: string[]}): Obj[] {
        return array.map(item =>
            keys.reduce<Obj>((picked, key) => {
                const value = ArrayUtils.get({object: item, path: key, defaultValue: MISSING});
                return value === MISSING ? picked : ArrayUtils.set({object: picked, path: key, value});
            }, {}),
        );
    }

    /** Collect `value` from every item, optionally keyed by another path. Both accept dot paths. */
    static pluck<T extends Obj>({array, value, key}: {array: T[]; value: string; key?: string}): any {
        if (key === undefined) {
            return array.map(item => ArrayUtils.get({object: item, path: value}));
        }

        return Object.fromEntries(array.map(item => [ArrayUtils.get({object: item, path: key}), ArrayUtils.get({object: item, path: value})]));
    }

    /** Index items by a path or callback. Later items replace earlier ones with the same key. */
    static keyBy<T extends Obj>({array, key}: {array: T[]; key: string | ((item: T, index: number) => Path)}): Record<string, T> {
        return Object.fromEntries(
            array.map((item, index) => [typeof key === 'function' ? key(item, index) : ArrayUtils.get({object: item, path: key}), item]),
        );
    }

    /** Callback returns a `{key: value}` object; the results are merged into one object. */
    static mapWithKeys<T, R = any>({array, callback}: {array: T[]; callback: (item: T, index: number) => Record<string, R>}): Record<string, R> {
        return Object.assign({}, ...array.map(callback));
    }

    /** Spread each nested item into the callback as separate arguments. */
    static mapSpread<T extends any[], R>({array, callback}: {array: T[]; callback: (...args: T) => R}): R[] {
        return array.map(item => callback(...item));
    }

    static prependKeysWith<T>({object, prefix}: {object: Record<string, T>; prefix: string}): Record<string, T> {
        return Object.fromEntries(Object.entries(object).map(([key, value]) => [`${prefix}${key}`, value]));
    }

    /** Split into `[passing, failing]` in one pass. */
    static partition<T>({array, callback}: {array: T[]; callback: (item: T, index: number) => boolean}): [T[], T[]] {
        const passing: T[] = [];
        const failing: T[] = [];
        array.forEach((item, index) => (callback(item, index) ? passing : failing).push(item));
        return [passing, failing];
    }

    static reject<T>({array, callback}: {array: T[]; callback: (item: T, index: number) => boolean}): T[] {
        return array.filter((item, index) => !callback(item, index));
    }

    static whereNotNull<T>(array: T[]): NonNullable<T>[] {
        return array.filter((item): item is NonNullable<T> => item != null);
    }

    static every<T>({array, callback}: {array: T[]; callback: (item: T, index: number) => boolean}): boolean {
        return array.every(callback);
    }

    static some<T>({array, callback}: {array: T[]; callback: (item: T, index: number) => boolean}): boolean {
        return array.some(callback);
    }

    static first<T, D = undefined>({
        array,
        callback,
        defaultValue,
    }: {
        array: T[];
        callback?: (item: T, index: number) => boolean;
        defaultValue?: D;
    }): T | D {
        const found = callback ? array.findIndex(callback) : array.length ? 0 : -1;
        return found === -1 ? (defaultValue as D) : (array[found] as T);
    }

    static last<T, D = undefined>({
        array,
        callback,
        defaultValue,
    }: {
        array: T[];
        callback?: (item: T, index: number) => boolean;
        defaultValue?: D;
    }): T | D {
        const found = callback ? array.findLastIndex(callback) : array.length - 1;
        return found === -1 ? (defaultValue as D) : (array[found] as T);
    }

    /** The only item passing the test. Throws when none or more than one match. */
    static sole<T>({array, callback}: {array: T[]; callback?: (item: T, index: number) => boolean}): T {
        const matches = callback ? array.filter(callback) : array;

        if (matches.length === 0) {
            throw new Error('No matching item was found.');
        }

        if (matches.length > 1) {
            throw new Error(`${matches.length} matching items were found, expected exactly one.`);
        }

        return matches[0] as T;
    }

    /** Positive `count` takes from the start, negative from the end. */
    static take<T>({array, count}: {array: T[]; count: number}): T[] {
        return count < 0 ? array.slice(count) : array.slice(0, count);
    }

    static random<T>(params: {array: T[]}): T | undefined;
    static random<T>(params: {array: T[]; count: number}): T[];
    static random<T>({array, count}: {array: T[]; count?: number}): T | T[] | undefined {
        if (count === undefined) {
            return array[Math.floor(Math.random() * array.length)];
        }

        return ArrayUtils.shuffle(array).slice(0, Math.max(0, count));
    }

    /** Sort by value, or by what `callback` returns for each item. */
    static sort<T>({array, callback}: {array: T[]; callback?: (item: T, index: number) => unknown}): T[] {
        return array
            .map((item, index) => ({item, key: callback ? callback(item, index) : item}))
            .sort((a, b) => compare(a.key, b.key))
            .map(({item}) => item);
    }

    static sortDesc<T>({array, callback}: {array: T[]; callback?: (item: T, index: number) => unknown}): T[] {
        return array
            .map((item, index) => ({item, key: callback ? callback(item, index) : item}))
            .sort((a, b) => compare(b.key, a.key))
            .map(({item}) => item);
    }

    /**
     * Sort object keys and plain lists at every depth. A list holding objects or lists keeps its
     * order (only its children are sorted), since there is no natural order between those.
     */
    static sortRecursive<T>({value, descending = false}: {value: T; descending?: boolean}): T {
        const direction = descending ? -1 : 1;

        if (Array.isArray(value)) {
            const items = value.map(item => ArrayUtils.sortRecursive({value: item, descending}));
            return (items.some(isContainer) ? items : items.sort((a, b) => direction * compare(a, b))) as T;
        }

        if (isContainer(value)) {
            return Object.keys(value)
                .sort((a, b) => direction * compare(a, b))
                .reduce<Obj>((sorted, key) => ({...sorted, [key]: ArrayUtils.sortRecursive({value: value[key], descending})}), {}) as T;
        }

        return value;
    }

    /** Join with `glue`; `finalGlue` replaces the last separator ("a, b, and c"). */
    static join({array, glue, finalGlue}: {array: unknown[]; glue: string; finalGlue?: string}): string {
        if (finalGlue === undefined || array.length < 2) {
            return array.join(glue);
        }

        return `${array.slice(0, -1).join(glue)}${finalGlue}${array[array.length - 1]}`;
    }

    static wrap<T>(value: T | T[] | null | undefined): T[] {
        if (value === null || value === undefined) {
            return [];
        }

        return Array.isArray(value) ? value : [value];
    }

    static collapse<T>(arrays: (T[] | null | undefined)[]): T[] {
        return arrays.flatMap(item => item ?? []);
    }

    /** Cartesian product of the given arrays. */
    static crossJoin(arrays: unknown[][]): unknown[][] {
        return arrays.reduce<unknown[][]>((product, array) => product.flatMap(combo => array.map(item => [...combo, item])), [[]]);
    }

    /** Split an object into `[keys, values]`. */
    static divide<T>(object: Record<string, T>): [string[], T[]] {
        return [Object.keys(object), Object.values(object)];
    }

    /** Flatten nested objects and arrays into one level of "dot" keys. */
    static dot({object, prepend = ''}: {object: Obj; prepend?: string}): Record<string, unknown> {
        return Object.entries(object).reduce<Record<string, unknown>>((flat, [key, value]) => {
            const path = `${prepend}${key}`;

            if (isContainer(value) && Object.keys(value).length > 0) {
                return {...flat, ...ArrayUtils.dot({object: value, prepend: `${path}.`})};
            }

            return {...flat, [path]: value};
        }, {});
    }

    /** Inverse of `dot`: expand "dot" keys into nested objects. */
    static undot(object: Record<string, unknown>): Obj {
        return Object.entries(object).reduce<Obj>((result, [path, value]) => ArrayUtils.set({object: result, path, value}), {});
    }

    /** Encode as a query string using bracket syntax (`order[column]=x`). `null` values are skipped. */
    static query(object: Obj): string {
        const encode = ({value, prefix}: {value: unknown; prefix: string}): string[] => {
            if (value === null || value === undefined) {
                return [];
            }

            if (isContainer(value)) {
                return Object.entries(value).flatMap(([key, item]) => encode({value: item, prefix: `${prefix}[${key}]`}));
            }

            const encoded = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
            return [`${encodeURIComponent(prefix)}=${encodeURIComponent(encoded)}`];
        };

        return Object.entries(object)
            .flatMap(([key, value]) => encode({value, prefix: key}))
            .join('&');
    }

    /** Build a class string. Strings always apply; in `{name: condition}` objects the name applies when truthy. */
    static toCssClasses(classes: (string | Record<string, unknown>)[]): string {
        return classes
            .flatMap(item =>
                typeof item === 'string'
                    ? [item]
                    : Object.entries(item)
                          .filter(([, enabled]) => Boolean(enabled))
                          .map(([name]) => name),
            )
            .join(' ');
    }
}

export default ArrayUtils;

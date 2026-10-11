import {useRef} from 'react';

import type {DeepPartial} from './types';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

/** Deep merge for plain objects. Everything else (arrays, functions, primitives) is replaced; `undefined` is skipped. */
export const mergeTheme = <T extends object>({base, overrides}: {base: T; overrides?: DeepPartial<T> | undefined}): T => {
    if (!overrides) {
        return base;
    }

    const result: Record<string, unknown> = {...(base as Record<string, unknown>)};

    Object.entries(overrides).forEach(([key, value]) => {
        if (value === undefined) {
            return;
        }

        const current = result[key];
        result[key] = isPlainObject(current) && isPlainObject(value) ? mergeTheme({base: current, overrides: value}) : value;
    });

    return result as T;
};

export const isEqual = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b)) {
        return true;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item, index) => isEqual(item, b[index]));
    }

    if (isPlainObject(a) && isPlainObject(b)) {
        const keys = Object.keys(a);
        return keys.length === Object.keys(b).length && keys.every(key => key in b && isEqual(a[key], b[key]));
    }

    return false;
};

/** Keeps the previous reference while the value stays deeply equal, so inline `{...}` props do not re-run memos. */
export const useStableValue = <T>(value: T): T => {
    const ref = useRef(value);

    if (!isEqual(ref.current, value)) {
        ref.current = value;
    }

    return ref.current;
};

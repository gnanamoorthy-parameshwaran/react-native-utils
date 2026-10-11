import {
    APIBadGatewayError,
    APIBadRequestError,
    APIConflictError,
    APIExpectationFailedError,
    APIFailedDependencyError,
    APIForbiddenError,
    APIGatewayTimeoutError,
    APIGeneralError,
    APIGoneError,
    APIHTTPVersionNotSupportedError,
    APIInsufficientStorageError,
    APILengthRequiredError,
    APILockedError,
    APILoopDetectedError,
    APIMethodNotAllowedError,
    APIMisdirectedRequestError,
    APINetworkAuthenticationRequiredError,
    APINotAcceptableError,
    APINotExtendedError,
    APINotFoundError,
    APINotImplementedError,
    APIPaymentRequiredError,
    APIPayloadTooLargeError,
    APIPreconditionFailedError,
    APIPreconditionRequiredError,
    APIProxyAuthenticationRequiredError,
    APIRangeNotSatisfiableError,
    APIRequestHeaderFieldsTooLargeError,
    APIRequestTimeoutError,
    APIServerError,
    APIServiceUnavailableError,
    APITeapotError,
    APITooEarlyError,
    APITooManyRequestsError,
    APIUnauthorizedError,
    APIUnavailableForLegalReasonsError,
    APIUnsupportedMediaTypeError,
    APIUpgradeRequiredError,
    APIURITooLongError,
    APIValidationError,
    APIVariantAlsoNegotiatesError,
} from './exceptions';
import type {QueryKey} from './types';

export const parseResponseBody = async (response: Response): Promise<any> => {
    if (response.status === 204 || response.status === 205) return undefined;
    if (response.headers.get('Content-Length') === '0') return undefined;

    const text = await response.text();
    if (!text) return undefined;

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

export const validateAndThrowExceptions = ({response, result}: {response: Response; result: any}): never => {
    switch (response.status) {
        /* 4xx — Client Errors */
        case 400:
            throw new APIBadRequestError(result?.message);
        case 401:
            throw new APIUnauthorizedError(result?.message);
        case 402:
            throw new APIPaymentRequiredError(result?.message);
        case 403:
            throw new APIForbiddenError(result?.message);
        case 404:
            throw new APINotFoundError(result?.message);
        case 405:
            throw new APIMethodNotAllowedError(result?.message);
        case 406:
            throw new APINotAcceptableError(result?.message);
        case 407:
            throw new APIProxyAuthenticationRequiredError(result?.message);
        case 408:
            throw new APIRequestTimeoutError(result?.message);
        case 409:
            throw new APIConflictError(result?.message);
        case 410:
            throw new APIGoneError(result?.message);
        case 411:
            throw new APILengthRequiredError(result?.message);
        case 412:
            throw new APIPreconditionFailedError(result?.message);
        case 413:
            throw new APIPayloadTooLargeError(result?.message);
        case 414:
            throw new APIURITooLongError(result?.message);
        case 415:
            throw new APIUnsupportedMediaTypeError(result?.message);
        case 416:
            throw new APIRangeNotSatisfiableError(result?.message);
        case 417:
            throw new APIExpectationFailedError(result?.message);
        case 418:
            throw new APITeapotError(result?.message);
        case 421:
            throw new APIMisdirectedRequestError(result?.message);
        case 422:
            throw new APIValidationError(result?.message ?? 'Validation failed', result?.errors ?? {});
        case 423:
            throw new APILockedError(result?.message);
        case 424:
            throw new APIFailedDependencyError(result?.message);
        case 425:
            throw new APITooEarlyError(result?.message);
        case 426:
            throw new APIUpgradeRequiredError(result?.message);
        case 428:
            throw new APIPreconditionRequiredError(result?.message);
        case 429:
            throw new APITooManyRequestsError(result?.message);
        case 431:
            throw new APIRequestHeaderFieldsTooLargeError(result?.message);
        case 451:
            throw new APIUnavailableForLegalReasonsError(result?.message);

        /* 5xx — Server Errors */
        case 500:
            throw new APIServerError(500, result?.message ?? 'Internal Server Error');
        case 501:
            throw new APINotImplementedError(result?.message);
        case 502:
            throw new APIBadGatewayError(result?.message);
        case 503:
            throw new APIServiceUnavailableError(result?.message);
        case 504:
            throw new APIGatewayTimeoutError(result?.message);
        case 505:
            throw new APIHTTPVersionNotSupportedError(result?.message);
        case 506:
            throw new APIVariantAlsoNegotiatesError(result?.message);
        case 507:
            throw new APIInsufficientStorageError(result?.message);
        case 508:
            throw new APILoopDetectedError(result?.message);
        case 510:
            throw new APINotExtendedError(result?.message);
        case 511:
            throw new APINetworkAuthenticationRequiredError(result?.message);

        default:
            // Any 5xx not explicitly listed above (unassigned/nonstandard) still surfaces as a
            // server error rather than falling through to the generic client-error fallback.
            if (response.status >= 500) throw new APIServerError(response.status, result?.message ?? 'Server Error');
            throw new APIGeneralError(response.status, result?.message ?? 'An error occurred while processing the request.');
    }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => Object.prototype.toString.call(value) === '[object Object]';

/**
 * Serializes a query key to a stable string. Object keys are sorted, so
 * `{page: 1, sort: 'asc'}` and `{sort: 'asc', page: 1}` hash to the same entry.
 */
export function hashKey(queryKey: QueryKey): string {
    return JSON.stringify(queryKey, (_key, value) =>
        isPlainObject(value)
            ? Object.keys(value)
                  .sort()
                  .reduce<Record<string, unknown>>((sorted, key) => {
                      sorted[key] = value[key];
                      return sorted;
                  }, {})
            : value,
    );
}

/**
 * True when every property present in `b` deep-equals the same property in `a`.
 * Extra properties on `a` are ignored, which is what lets a key filter match partially.
 */
export function partialDeepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b || !a || !b || typeof a !== 'object') return false;

    return Object.keys(b as object).every(key => partialDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/**
 * True when `filter` is a prefix of `queryKey`: `['posts']` matches
 * `['posts', {page: 2}]`. Object segments match partially, so
 * `['posts', {userId: 1}]` also matches `['posts', {userId: 1, page: 2}]`.
 */
export function matchKey(queryKey: QueryKey, filter: QueryKey): boolean {
    if (filter.length > queryKey.length) return false;

    return filter.every((segment, index) => partialDeepEqual(queryKey[index], segment));
}

/**
 * Structural sharing: returns `next`, but with every part that deep-equals the
 * matching part of `previous` replaced by the `previous` reference. If nothing
 * changed, `previous` itself is returned. Unchanged list items keep their
 * identity, so memoized rows and effects depending on them skip work after a
 * refetch. Only plain objects and arrays are walked; anything else compares by `===`.
 */
export function replaceEqualDeep<T>(previous: unknown, next: T): T {
    if (previous === next) return next;

    const bothArrays = Array.isArray(previous) && Array.isArray(next);
    if (!bothArrays && !(isPlainObject(previous) && isPlainObject(next))) return next;

    const previousItems = previous as Record<string, unknown>;
    const nextItems = next as Record<string, unknown>;
    const previousKeys = Object.keys(previousItems);
    const nextKeys = Object.keys(nextItems);
    const merged = (bothArrays ? [] : {}) as Record<string, unknown>;
    let unchanged = 0;

    for (const key of nextKeys) {
        merged[key] = replaceEqualDeep(previousItems[key], nextItems[key]);
        if (merged[key] === previousItems[key] && Object.prototype.hasOwnProperty.call(previousItems, key)) unchanged++;
    }

    return (previousKeys.length === nextKeys.length && unchanged === previousKeys.length ? previous : merged) as T;
}

/** Stand-in when no focus hook is passed to `createAPI`, so `useQuery` calls the same hooks every render. */
export function noFocusEffect(): void {}

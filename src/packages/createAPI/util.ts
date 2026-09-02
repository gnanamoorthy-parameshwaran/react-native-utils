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
import type {FetchProps} from './types';

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

export function getCacheKey({
    method = 'GET',
    endpoint,
    query,
}: {
    method: FetchProps['method'];
    endpoint: string;
    query?: Record<string, string>;
}): string {
    if (!query || Object.keys(query).length === 0) return `${method}:${endpoint}`;

    const sorted = Object.keys(query)
        .sort()
        .map(key => `${key}=${query[key]}`)
        .join('&');
    return `${method}:${endpoint}?${sorted}`;
}

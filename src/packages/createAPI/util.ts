import {
    APIBadGatewayError,
    APIBadRequestError,
    APIForbiddenError,
    APIGatewayTimeoutError,
    APIGeneralError,
    APINotFoundError,
    APIServerError,
    APITooManyRequestsError,
    APIUnauthorizedError,
    APIValidationError,
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
        case 400:
            throw new APIBadRequestError(result?.message);
        case 401:
            throw new APIUnauthorizedError(result?.message);
        case 403:
            throw new APIForbiddenError(result?.message);
        case 404:
            throw new APINotFoundError(result?.message);
        case 422:
            throw new APIValidationError(result?.message ?? 'Validation failed', result?.errors ?? {});
        case 429:
            throw new APITooManyRequestsError(result?.message);
        case 500:
            throw new APIServerError(500, result?.message ?? 'Internal Server Error');
        case 502:
            throw new APIBadGatewayError(result?.message);
        case 504:
            throw new APIGatewayTimeoutError(result?.message);
        default:
            throw new APIGeneralError(response.status, result?.message ?? 'An error occurred while processing the request.');
    }
};

export function getCacheKey({method = 'GET', endpoint}: {method: FetchProps['method']; endpoint: string}): string {
    return `${method}:${endpoint}`;
}

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
import type { FetchProps } from './types';

export const prepareRequestBody = ({ body }: { body: FetchProps['body'] }) => {
  if (body instanceof FormData) {
    return body;
  } else {
    return body ? JSON.stringify(body) : undefined;
  }
};

export const validateAndThrowExceptions = ({
  response,
  result,
}: {
  response: Response;
  result: any;
}): void => {
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
      throw new APIValidationError(
        result?.message ?? 'Validation failed',
        result?.errors ?? {}
      );
    case 429:
      throw new APITooManyRequestsError(result?.message);
    case 500:
      throw new APIServerError(500, result?.message ?? 'Internal Server Error');
    case 502:
      throw new APIBadGatewayError(result?.message);
    case 504:
      throw new APIGatewayTimeoutError(result?.message);
    default:
      throw new APIGeneralError(
        response.status,
        result?.message ?? 'An error occurred while processing the request.'
      );
  }
};

export function getCacheKey(
  method: FetchProps['method'] = 'GET',
  endpoint: string
): string {
  return `${method}:${endpoint}`;
}

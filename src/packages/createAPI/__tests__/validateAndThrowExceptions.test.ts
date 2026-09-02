import * as Exceptions from '../exceptions';
import {validateAndThrowExceptions} from '../util';

const response = (status: number) => ({status}) as Response;

// Every status code the switch is expected to have its own exception class for,
// paired with the class it must throw -- keeps this test honest against the
// exceptions module rather than re-deriving the mapping by hand per case.
const STATUS_TO_EXCEPTION: [number, new (...args: any[]) => Exceptions.APIGeneralError][] = [
    [400, Exceptions.APIBadRequestError],
    [401, Exceptions.APIUnauthorizedError],
    [402, Exceptions.APIPaymentRequiredError],
    [403, Exceptions.APIForbiddenError],
    [404, Exceptions.APINotFoundError],
    [405, Exceptions.APIMethodNotAllowedError],
    [406, Exceptions.APINotAcceptableError],
    [407, Exceptions.APIProxyAuthenticationRequiredError],
    [408, Exceptions.APIRequestTimeoutError],
    [409, Exceptions.APIConflictError],
    [410, Exceptions.APIGoneError],
    [411, Exceptions.APILengthRequiredError],
    [412, Exceptions.APIPreconditionFailedError],
    [413, Exceptions.APIPayloadTooLargeError],
    [414, Exceptions.APIURITooLongError],
    [415, Exceptions.APIUnsupportedMediaTypeError],
    [416, Exceptions.APIRangeNotSatisfiableError],
    [417, Exceptions.APIExpectationFailedError],
    [418, Exceptions.APITeapotError],
    [421, Exceptions.APIMisdirectedRequestError],
    [422, Exceptions.APIValidationError],
    [423, Exceptions.APILockedError],
    [424, Exceptions.APIFailedDependencyError],
    [425, Exceptions.APITooEarlyError],
    [426, Exceptions.APIUpgradeRequiredError],
    [428, Exceptions.APIPreconditionRequiredError],
    [429, Exceptions.APITooManyRequestsError],
    [431, Exceptions.APIRequestHeaderFieldsTooLargeError],
    [451, Exceptions.APIUnavailableForLegalReasonsError],
    [500, Exceptions.APIServerError],
    [501, Exceptions.APINotImplementedError],
    [502, Exceptions.APIBadGatewayError],
    [503, Exceptions.APIServiceUnavailableError],
    [504, Exceptions.APIGatewayTimeoutError],
    [505, Exceptions.APIHTTPVersionNotSupportedError],
    [506, Exceptions.APIVariantAlsoNegotiatesError],
    [507, Exceptions.APIInsufficientStorageError],
    [508, Exceptions.APILoopDetectedError],
    [510, Exceptions.APINotExtendedError],
    [511, Exceptions.APINetworkAuthenticationRequiredError],
];

describe('validateAndThrowExceptions', () => {
    it.each(STATUS_TO_EXCEPTION)('throws %s as an instance of %p, carrying that status', (status, ExceptionClass) => {
        let thrown: unknown;
        try {
            validateAndThrowExceptions({response: response(status), result: undefined});
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(ExceptionClass);
        expect(thrown).toBeInstanceOf(Exceptions.APIGeneralError);
        expect((thrown as Exceptions.APIGeneralError).status).toBe(status);
    });

    it('every 5xx status not explicitly mapped still throws APIServerError, not the generic client fallback', () => {
        let thrown: unknown;
        try {
            validateAndThrowExceptions({response: response(599), result: {message: 'weird'}});
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(Exceptions.APIServerError);
        expect((thrown as Exceptions.APIGeneralError).status).toBe(599);
        expect((thrown as Error).message).toBe('weird');
    });

    it('an unmapped 4xx status falls through to the generic APIGeneralError', () => {
        let thrown: unknown;
        try {
            validateAndThrowExceptions({response: response(499), result: undefined});
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(Exceptions.APIGeneralError);
        expect(thrown).not.toBeInstanceOf(Exceptions.APIServerError);
        expect((thrown as Exceptions.APIGeneralError).status).toBe(499);
    });

    it('carries the response body message through when present', () => {
        let thrown: unknown;
        try {
            validateAndThrowExceptions({response: response(404), result: {message: 'Business unit not found'}});
        } catch (error) {
            thrown = error;
        }

        expect((thrown as Error).message).toBe('Business unit not found');
    });

    it('carries validation errors through on 422', () => {
        let thrown: unknown;
        try {
            validateAndThrowExceptions({response: response(422), result: {message: 'Invalid', errors: {name: ['required']}}});
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(Exceptions.APIValidationError);
        expect((thrown as Exceptions.APIGeneralError).errors).toEqual({name: ['required']});
    });
});

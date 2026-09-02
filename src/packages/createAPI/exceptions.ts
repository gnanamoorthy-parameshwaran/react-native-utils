import type {ValidationErrors} from './types';

export class APIGeneralError extends Error {
    readonly status: number;
    readonly errors?: ValidationErrors;

    constructor(status: number, message: string, errors?: ValidationErrors) {
        super(message);
        this.status = status;
        this.errors = errors;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/* 4xx — Client Errors */

export class APIBadRequestError extends APIGeneralError {
    constructor(message = 'Bad Request') {
        super(400, message);
    }
}

export class APIUnauthorizedError extends APIGeneralError {
    constructor(message = 'Unauthorized') {
        super(401, message);
    }
}

export class APIPaymentRequiredError extends APIGeneralError {
    constructor(message = 'Payment Required') {
        super(402, message);
    }
}

export class APIForbiddenError extends APIGeneralError {
    constructor(message = 'Forbidden') {
        super(403, message);
    }
}

export class APINotFoundError extends APIGeneralError {
    constructor(message = 'Not Found') {
        super(404, message);
    }
}

export class APIMethodNotAllowedError extends APIGeneralError {
    constructor(message = 'Method Not Allowed') {
        super(405, message);
    }
}

export class APINotAcceptableError extends APIGeneralError {
    constructor(message = 'Not Acceptable') {
        super(406, message);
    }
}

export class APIProxyAuthenticationRequiredError extends APIGeneralError {
    constructor(message = 'Proxy Authentication Required') {
        super(407, message);
    }
}

export class APIRequestTimeoutError extends APIGeneralError {
    constructor(message = 'Request Timeout') {
        super(408, message);
    }
}

export class APIConflictError extends APIGeneralError {
    constructor(message = 'Conflict') {
        super(409, message);
    }
}

export class APIGoneError extends APIGeneralError {
    constructor(message = 'Gone') {
        super(410, message);
    }
}

export class APILengthRequiredError extends APIGeneralError {
    constructor(message = 'Length Required') {
        super(411, message);
    }
}

export class APIPreconditionFailedError extends APIGeneralError {
    constructor(message = 'Precondition Failed') {
        super(412, message);
    }
}

export class APIPayloadTooLargeError extends APIGeneralError {
    constructor(message = 'Payload Too Large') {
        super(413, message);
    }
}

export class APIURITooLongError extends APIGeneralError {
    constructor(message = 'URI Too Long') {
        super(414, message);
    }
}

export class APIUnsupportedMediaTypeError extends APIGeneralError {
    constructor(message = 'Unsupported Media Type') {
        super(415, message);
    }
}

export class APIRangeNotSatisfiableError extends APIGeneralError {
    constructor(message = 'Range Not Satisfiable') {
        super(416, message);
    }
}

export class APIExpectationFailedError extends APIGeneralError {
    constructor(message = 'Expectation Failed') {
        super(417, message);
    }
}

export class APITeapotError extends APIGeneralError {
    constructor(message = "I'm a Teapot") {
        super(418, message);
    }
}

export class APIMisdirectedRequestError extends APIGeneralError {
    constructor(message = 'Misdirected Request') {
        super(421, message);
    }
}

export class APIValidationError extends APIGeneralError {
    constructor(message = 'Validation failed', errors: ValidationErrors) {
        super(422, message, errors);
    }
}

export class APILockedError extends APIGeneralError {
    constructor(message = 'Locked') {
        super(423, message);
    }
}

export class APIFailedDependencyError extends APIGeneralError {
    constructor(message = 'Failed Dependency') {
        super(424, message);
    }
}

export class APITooEarlyError extends APIGeneralError {
    constructor(message = 'Too Early') {
        super(425, message);
    }
}

export class APIUpgradeRequiredError extends APIGeneralError {
    constructor(message = 'Upgrade Required') {
        super(426, message);
    }
}

export class APIPreconditionRequiredError extends APIGeneralError {
    constructor(message = 'Precondition Required') {
        super(428, message);
    }
}

export class APITooManyRequestsError extends APIGeneralError {
    constructor(message = 'Too Many Requests') {
        super(429, message);
    }
}

export class APIRequestHeaderFieldsTooLargeError extends APIGeneralError {
    constructor(message = 'Request Header Fields Too Large') {
        super(431, message);
    }
}

export class APIUnavailableForLegalReasonsError extends APIGeneralError {
    constructor(message = 'Unavailable For Legal Reasons') {
        super(451, message);
    }
}

/* 5xx — Server Errors */

export class APIServerError extends APIGeneralError {
    constructor(status: number, message = 'Server Error') {
        super(status, message);
    }
}

export class APINotImplementedError extends APIServerError {
    constructor(message = 'Not Implemented') {
        super(501, message);
    }
}

export class APIBadGatewayError extends APIServerError {
    constructor(message = 'Bad Gateway') {
        super(502, message);
    }
}

export class APIServiceUnavailableError extends APIServerError {
    constructor(message = 'Service Unavailable') {
        super(503, message);
    }
}

export class APIGatewayTimeoutError extends APIServerError {
    constructor(message = 'Gateway Timeout') {
        super(504, message);
    }
}

export class APIHTTPVersionNotSupportedError extends APIServerError {
    constructor(message = 'HTTP Version Not Supported') {
        super(505, message);
    }
}

export class APIVariantAlsoNegotiatesError extends APIServerError {
    constructor(message = 'Variant Also Negotiates') {
        super(506, message);
    }
}

export class APIInsufficientStorageError extends APIServerError {
    constructor(message = 'Insufficient Storage') {
        super(507, message);
    }
}

export class APILoopDetectedError extends APIServerError {
    constructor(message = 'Loop Detected') {
        super(508, message);
    }
}

export class APINotExtendedError extends APIServerError {
    constructor(message = 'Not Extended') {
        super(510, message);
    }
}

export class APINetworkAuthenticationRequiredError extends APIServerError {
    constructor(message = 'Network Authentication Required') {
        super(511, message);
    }
}

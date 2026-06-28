import type { ValidationErrors } from './types';

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

export class APIValidationError extends APIGeneralError {
  constructor(message = 'Validation failed', errors: ValidationErrors) {
    super(422, message, errors);
  }
}

export class APITooManyRequestsError extends APIGeneralError {
  constructor(message = 'Too Many Requests') {
    super(429, message);
  }
}

/* 5xx — Server Errors */

export class APIServerError extends APIGeneralError {
  constructor(status: number, message = 'Server Error') {
    super(status, message);
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

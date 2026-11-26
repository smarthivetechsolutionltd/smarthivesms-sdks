export class SmarthiveError extends Error {
  public readonly statusCode: number;
  public readonly response?: unknown;
  public readonly isSandbox: boolean;

  constructor(
    message: string,
    statusCode: number = 0,
    response?: unknown,
    isSandbox: boolean = false
  ) {
    super(message);
    this.name = "SmarthiveError";
    this.statusCode = statusCode;
    this.response = response;
    this.isSandbox = isSandbox;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SmarthiveAuthError extends SmarthiveError {
  constructor(message: string, statusCode: number = 401, response?: unknown, isSandbox = false) {
    super(message, statusCode, response, isSandbox);
    this.name = "SmarthiveAuthError";
  }
}

export class SmarthiveValidationError extends SmarthiveError {
  constructor(message: string, statusCode: number = 400, response?: unknown, isSandbox = false) {
    super(message, statusCode, response, isSandbox);
    this.name = "SmarthiveValidationError";
  }
}

export class SmarthiveRateLimitError extends SmarthiveError {
  public readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    statusCode: number = 429,
    response?: unknown,
    retryAfterSeconds?: number,
    isSandbox = false
  ) {
    super(message, statusCode, response, isSandbox);
    this.name = "SmarthiveRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

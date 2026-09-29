export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(what: string, id: string) {
    super(`${what} ${id} not found`, 'not_found', 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'validation_failed', 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'authentication required') {
    super(message, 'unauthorized', 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'conflict', 409);
  }
}

export class ProviderTimeoutError extends AppError {
  constructor(provider: string, timeoutMs: number) {
    super(`${provider} timed out after ${timeoutMs}ms`, 'provider_timeout', 504);
  }
}

export class PaymentDeclinedError extends AppError {
  constructor(reason: string) {
    super(`payment declined: ${reason}`, 'payment_declined', 402);
  }
}

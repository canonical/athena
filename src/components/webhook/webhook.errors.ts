import { HttpError } from "@components/express/express.errors.js";

export class WebhookValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 400, message, details });
    this.name = `WebhookValidationError`;
  }
}

export class WebhookNotFoundError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 404, message, details });
    this.name = `WebhookNotFoundError`;
  }
}

export class WebhookForbiddenError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 403, message, details });
    this.name = `WebhookForbiddenError`;
  }
}

export class WebhookUnauthorizedError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 401, message, details });
    this.name = `WebhookUnauthorizedError`;
  }
}

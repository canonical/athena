import { HttpError } from "@components/express/express.errors.js";

export class ProviderValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 400, message, details });
    this.name = `ProviderValidationError`;
  }
}

export class ProviderNotFoundError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 404, message, details });
    this.name = `ProviderNotFoundError`;
  }
}

export class ProviderForbiddenError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 403, message, details });
    this.name = `ProviderForbiddenError`;
  }
}

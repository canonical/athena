import { HttpError } from "@components/express/express.errors.js";

export class LoopValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 400, message, details });
    this.name = `LoopValidationError`;
  }
}

export class LoopNotFoundError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 404, message, details });
    this.name = `LoopNotFoundError`;
  }
}

export class LoopForbiddenError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 403, message, details });
    this.name = `LoopForbiddenError`;
  }
}

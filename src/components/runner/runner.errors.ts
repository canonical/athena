import { HttpError } from "@components/express/express.errors.js";

export class RunnerValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 400, message, details });
    this.name = `RunnerValidationError`;
  }
}

export class RunnerNotFoundError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 404, message, details });
    this.name = `RunnerNotFoundError`;
  }
}

export class RunnerForbiddenError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 403, message, details });
    this.name = `RunnerForbiddenError`;
  }
}

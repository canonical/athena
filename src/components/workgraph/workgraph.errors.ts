import { HttpError } from "@components/express/express.errors.js";

export class WorkgraphValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 400, message, details });
    this.name = `WorkgraphValidationError`;
  }
}

export class WorkgraphNotFoundError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 404, message, details });
    this.name = `WorkgraphNotFoundError`;
  }
}

export class WorkgraphForbiddenError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 403, message, details });
    this.name = `WorkgraphForbiddenError`;
  }
}

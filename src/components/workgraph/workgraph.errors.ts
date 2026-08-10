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

export class WorkgraphUnauthorizedError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 401, message, details });
    this.name = `WorkgraphUnauthorizedError`;
  }
}

export class WorkgraphSyncError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 502, message, details });
    this.name = `WorkgraphSyncError`;
  }
}

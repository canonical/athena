import { HttpError } from "@components/express/express.errors.js";

export class RagNotFoundError extends HttpError {
  constructor(message: string) {
    super({ status: 404, message });
    this.name = `RagNotFoundError`;
  }
}

export class RagForbiddenError extends HttpError {
  constructor(message: string) {
    super({ status: 403, message });
    this.name = `RagForbiddenError`;
  }
}

export class RagValidationError extends HttpError {
  constructor(message: string) {
    super({ status: 400, message });
    this.name = `RagValidationError`;
  }
}

export class RagExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = `RagExecutionError`;
  }
}

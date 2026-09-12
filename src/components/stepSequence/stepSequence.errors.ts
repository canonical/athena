import { HttpError } from "@components/express/express.errors.js";

export class StepSequenceValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 400, message, details });
    this.name = `StepSequenceValidationError`;
  }
}

export class StepSequenceNotFoundError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 404, message, details });
    this.name = `StepSequenceNotFoundError`;
  }
}

export class StepSequenceForbiddenError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 403, message, details });
    this.name = `StepSequenceForbiddenError`;
  }
}

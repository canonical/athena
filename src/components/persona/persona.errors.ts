import { HttpError } from "@components/express/express.errors.js";

export class PersonaValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 400, message, details });
    this.name = `PersonaValidationError`;
  }
}

export class PersonaNotFoundError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 404, message, details });
    this.name = `PersonaNotFoundError`;
  }
}

export class PersonaForbiddenError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 403, message, details });
    this.name = `PersonaForbiddenError`;
  }
}

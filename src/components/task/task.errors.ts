import { HttpError } from "@components/express/express.errors.js";
import type { RouteSelectionRequired } from "./task.schema.js";

export class TaskValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 400, message, details });
    this.name = `TaskValidationError`;
  }
}

export class TaskAccessError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 404, message, details });
    this.name = `TaskAccessError`;
  }
}

export class TaskConflictError extends HttpError {
  constructor(message: string, details?: unknown) {
    super({ status: 409, message, details });
    this.name = `TaskConflictError`;
  }
}

export class TaskClaimLostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = `TaskClaimLostError`;
  }
}

export class RouteSelectionRequiredClientError extends Error {
  selection: RouteSelectionRequired;

  constructor(selection: RouteSelectionRequired) {
    super(selection.message);
    this.selection = selection;
    this.name = `RouteSelectionRequiredClientError`;
  }
}

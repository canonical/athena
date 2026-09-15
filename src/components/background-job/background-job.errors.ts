export class BackgroundJobConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = `BackgroundJobConfigurationError`;
  }
}

export class BackgroundJobUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = `BackgroundJobUnavailableError`;
  }
}

export class BackgroundJobPermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = `BackgroundJobPermanentError`;
  }
}

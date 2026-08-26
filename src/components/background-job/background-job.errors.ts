export class BackgroundJobConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = `BackgroundJobConfigurationError`;
  }
}

export class BackgroundJobEnqueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = `BackgroundJobEnqueueError`;
  }
}

export class BackgroundJobPermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = `BackgroundJobPermanentError`;
  }
}

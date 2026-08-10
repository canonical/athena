export type HttpErrorShape = {
  status: number;
  message: string;
  details?: unknown;
};

export class HttpError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor({ status, message, details }: HttpErrorShape) {
    super(message);
    this.name = `HttpError`;
    this.status = status;
    this.details = details;
  }
}

export const isHttpErrorShape = (value: unknown): value is HttpErrorShape => {
  if (!value || typeof value !== `object`) {
    return false;
  }

  const candidate = value as Partial<HttpErrorShape>;

  return Number.isInteger(candidate.status) && (candidate.status as number) >= 400 && (candidate.status as number) <= 599 && typeof candidate.message === `string`;
};

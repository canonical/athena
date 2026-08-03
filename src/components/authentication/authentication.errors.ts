export class UnauthenticatedError extends Error {
  constructor(message = `Authentication required`) {
    super(message);
    this.name = `UnauthenticatedError`;
  }
}

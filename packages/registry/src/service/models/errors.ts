export class ServiceIsActiveError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ServiceIsActiveError.prototype);
  }
}

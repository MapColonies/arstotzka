export class ServiceAlreadyLockedError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ServiceAlreadyLockedError.prototype);
  }
}

export class LockNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, LockNotFoundError.prototype);
  }
}

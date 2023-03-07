export class ServiceNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ServiceNotFoundError.prototype);
  }
}

export class ServiceAlreadyLockedError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ServiceAlreadyLockedError.prototype);
  }
}

export class ServiceIsActiveError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ServiceIsActiveError.prototype);
  }
}

export class LockNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, LockNotFoundError.prototype);
  }
}

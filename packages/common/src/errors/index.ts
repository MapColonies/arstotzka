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

export class LockNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, LockNotFoundError.prototype);
  }
}

export class ServiceUnaccessibleError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ServiceUnaccessibleError.prototype);
  }
}

export class ActionNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ActionNotFoundError.prototype);
  }
}

export class ActionAlreadyClosedError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ActionAlreadyClosedError.prototype);
  }
}

export class ParallelismMismatchError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ParallelismMismatchError.prototype);
  }
}

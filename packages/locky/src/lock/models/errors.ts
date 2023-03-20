export class ActiveBlockingActionsError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ActiveBlockingActionsError.prototype);
  }
}

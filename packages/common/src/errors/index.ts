export class ServiceNotRecognizedByRegistry extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ServiceNotRecognizedByRegistry.prototype);
  }
}

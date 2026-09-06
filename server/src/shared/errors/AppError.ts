export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly isOperational = true,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    this.name = "AppError";
  }
}

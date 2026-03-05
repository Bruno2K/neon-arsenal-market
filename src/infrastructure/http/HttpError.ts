// ─── Infrastructure: HttpError ───────────────────────────────────────────────
// Typed error class for HTTP failures.
// Keeps the domain clean: only HttpError crosses the infrastructure boundary.

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  get isUnauthorized(): boolean { return this.status === 401; }
  get isForbidden(): boolean    { return this.status === 403; }
  get isNotFound(): boolean     { return this.status === 404; }
  get isConflict(): boolean     { return this.status === 409; }
  get isServerError(): boolean  { return this.status >= 500; }
}

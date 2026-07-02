export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code: string, status: number = 500) {
    super(message);
    this.code = code;
    this.status = status;
    
    // Ensure the prototype chain is correctly set
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Creates and returns a new AppError to be thrown.
 * @param message The user-facing error message
 * @param code The system-wide string code identifying the error
 * @param status The HTTP status code (default 500)
 */
export const createError = (message: string, code: string, status: number = 500): AppError => {
  return new AppError(message, code, status);
};

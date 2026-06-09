export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (m: string) => new AppError(400, m);
export const notFound = (m: string) => new AppError(404, m);
export const tooLarge = (m: string) => new AppError(413, m);
export const unsupported = (m: string) => new AppError(415, m);

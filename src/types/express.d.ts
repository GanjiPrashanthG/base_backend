declare global {
  namespace Express {
    interface Locals {
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }

    interface Request {
      id?: string;
    }
  }
}

export {};

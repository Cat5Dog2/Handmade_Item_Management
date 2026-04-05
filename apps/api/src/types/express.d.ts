import type { AuthContext } from "@handmade/shared";

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

export {};

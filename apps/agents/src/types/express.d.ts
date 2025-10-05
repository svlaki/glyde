import 'express-serve-static-core';

declare global {
  namespace Express {
    interface Request {
      /**
       * The authenticated Supabase user ID extracted from the request's bearer token.
       */
      authUserId?: string;
    }
  }
}

export {};

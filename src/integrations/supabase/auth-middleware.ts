// Replaced by the Express+SQLite backend. Auth lives in cookie sessions
// validated server-side by the Express API. This file is a no-op stub.
import { createMiddleware } from "@tanstack/react-start";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  return next();
});

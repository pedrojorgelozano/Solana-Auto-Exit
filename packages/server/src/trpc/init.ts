import { initTRPC, TRPCError } from "@trpc/server";
import type { AppContext } from "./context.js";

const t = initTRPC.context<AppContext>().create({
  /** Mantener mensajes de error de Error.message tal cual en producción. */
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    message: error.message,
  }),
});

export const router = t.router;
export const publicProcedure = t.procedure;
export { TRPCError };

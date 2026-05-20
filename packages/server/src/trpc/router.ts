import { initTRPC } from "@trpc/server";
import type { AppContext } from "./context.js";

const t = initTRPC.context<AppContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Router raíz. Por ahora solo un endpoint de salud. Los routers reales
 * (positions, tasks, wallet, settings, history) llegan en F0.7.
 */
export const appRouter = router({
  health: publicProcedure.query(() => ({
    ok: true,
    time: new Date().toISOString(),
    version: "0.1.0",
  })),
});

export type AppRouter = typeof appRouter;

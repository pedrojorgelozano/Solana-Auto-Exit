import { router, publicProcedure } from "./init.js";
import { walletRouter } from "./routers/wallet.js";
import { positionsRouter } from "./routers/positions.js";
import { tasksRouter } from "./routers/tasks.js";

export const appRouter = router({
  health: publicProcedure.query(() => ({
    ok: true,
    time: new Date().toISOString(),
    version: "0.1.0",
  })),
  wallet: walletRouter,
  positions: positionsRouter,
  tasks: tasksRouter,
});

export type AppRouter = typeof appRouter;

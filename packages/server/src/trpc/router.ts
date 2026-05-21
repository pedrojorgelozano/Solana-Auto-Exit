import { router, publicProcedure } from "./init.js";
import { walletRouter } from "./routers/wallet.js";
import { positionsRouter } from "./routers/positions.js";
import { tasksRouter } from "./routers/tasks.js";
import { settingsRouter } from "./routers/settings.js";

export const appRouter = router({
  health: publicProcedure.query(() => ({
    ok: true,
    time: new Date().toISOString(),
    version: "0.1.0",
  })),
  wallet: walletRouter,
  positions: positionsRouter,
  tasks: tasksRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;

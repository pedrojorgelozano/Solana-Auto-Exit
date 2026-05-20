import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";

import { db, runMigrations, closeDb } from "./db/client.js";
import { appRouter } from "./trpc/router.js";
import type { AppContext } from "./trpc/context.js";

// =============================================================================
// Bootstrap
// =============================================================================

runMigrations();

const app = new Hono();

app.get("/", (c) =>
  c.text("solana-auto-exit server. tRPC endpoint at /trpc/*"),
);

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (): AppContext => ({ db }),
  }),
);

// =============================================================================
// Listen on localhost only by default
// =============================================================================

const port = Number(process.env.SERVER_PORT ?? 7777);
const host = process.env.SERVER_HOST ?? "127.0.0.1";

const server = serve(
  {
    fetch: app.fetch,
    port,
    hostname: host,
  },
  (info) => {
    console.log(
      `[server] listening on http://${info.address}:${info.port} (host=${host})`,
    );
  },
);

// =============================================================================
// Graceful shutdown
// =============================================================================

function shutdown(signal: string): void {
  console.log(`\n[server] ${signal} received, shutting down...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

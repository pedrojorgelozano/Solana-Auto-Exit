import path from "node:path";

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";

import { db, runMigrations, closeDb } from "./db/client.js";
import { appRouter } from "./trpc/router.js";
import type { AppContext } from "./trpc/context.js";
import { WalletVault } from "./wallet/vault.js";
import { TaskManager } from "./tasks/manager.js";

// =============================================================================
// Bootstrap
// =============================================================================

runMigrations();

const VAULT_PATH =
  process.env.WALLET_VAULT_PATH ??
  path.resolve(process.cwd(), "data", "wallet.vault");
const vault = new WalletVault(VAULT_PATH);

const taskManager = new TaskManager(db, vault);
await taskManager.boot();

const app = new Hono();

app.get("/", (c) =>
  c.text("solana-auto-exit server. tRPC endpoint at /trpc/*"),
);

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (): AppContext => ({ db, vault, taskManager }),
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
    console.log(`[server] vault path: ${VAULT_PATH}`);
  },
);

// =============================================================================
// Graceful shutdown
// =============================================================================

function shutdown(signal: string): void {
  console.log(`\n[server] ${signal} received, shutting down...`);
  taskManager.shutdown();
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

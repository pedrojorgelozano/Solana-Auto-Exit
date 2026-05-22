import path from "node:path";

import { Hono } from "hono";
import { cors } from "hono/cors";
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

// -----------------------------------------------------------------------------
// CORS: se permiten los orígenes del frontend local (Next dev/prod, por env)
// y el webview de la app Tauri, cuyo origin depende del SO. Cualquier otro
// origen no recibe Access-Control-Allow-Origin. Acceso remoto vía VPS (F3+):
// añadir el host por env CORS_ORIGINS.
// -----------------------------------------------------------------------------
const corsOrigins = (
  process.env.CORS_ORIGINS ?? "http://127.0.0.1:3000,http://localhost:3000"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// El webview de Tauri tiene un origin propio según la plataforma: Windows usa
// `http://tauri.localhost`, macOS/Linux `tauri://localhost`. Se aceptan ambos
// además de la lista configurada — sin esto, la app de escritorio no puede
// hablar con su sidecar (el frontend en `tauri dev` sí, porque va por
// localhost:3000, y por eso el bug no salía hasta instalar la app).
function resolveCorsOrigin(origin: string): string | null {
  if (!origin) return null;
  if (corsOrigins.includes(origin)) return origin;
  if (/^https?:\/\/tauri\.localhost$/.test(origin)) return origin;
  if (origin === "tauri://localhost") return origin;
  console.warn(`[cors] origen rechazado: ${origin}`);
  return null;
}

app.use(
  "/trpc/*",
  cors({
    origin: (origin) => resolveCorsOrigin(origin),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 86400,
  }),
);

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

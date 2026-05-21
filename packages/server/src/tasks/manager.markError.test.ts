import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "../db/schema.js";
import type { Db } from "../db/client.js";
import { TaskManager } from "./manager.js";
import { WalletVault } from "../wallet/vault.js";
import type { CreateTaskInput } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// drizzle/ vive en packages/server/drizzle. Este test está en packages/server/src/tasks.
const MIGRATIONS = path.resolve(__dirname, "..", "..", "drizzle");

function newDb(): Db {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  return db as Db;
}

function inputFixture(): CreateTaskInput {
  return {
    protocol: "orca",
    network: "devnet",
    rpcUrl: "https://api.devnet.solana.com",
    positionId: "PoSiTiOnId11111111111111111111111111111111",
    protocolConfig: { positionMint: "x", decimalsA: 9, decimalsB: 6 },
    takeProfitPrice: 100,
    stopLossPrice: null,
    takeProfitBufferMs: null,
    stopLossBufferMs: null,
    slippageBps: 100,
    pollMs: 10_000,
    dryRun: true,
    exitSwapSlippageBps: 100,
  };
}

describe("TaskManager.markError honors user-decided statuses (B-01)", () => {
  let mgr: TaskManager;

  beforeEach(() => {
    const db = newDb();
    // El vault no se usa en este test (no llamamos a start), pero el constructor
    // lo requiere. Apuntamos a una ruta de tmp que nunca existirá.
    const vault = new WalletVault("/tmp/never-exists-vault");
    mgr = new TaskManager(db, vault);
  });

  it("markError does NOT overwrite a 'paused' status", () => {
    const { id } = mgr.createTask(inputFixture());
    mgr.pauseTask(id);
    expect(mgr.getTask(id)!.status).toBe("paused");

    // Acceder al método privado: TS permite via cast a any. Aceptable en
    // tests; alternativa sería hacer markError protected o exponer un helper.
    (mgr as unknown as { markError: (id: string, err: unknown) => void })
      .markError(id, new Error("rpc timeout after close attempt"));

    const after = mgr.getTask(id)!;
    expect(after.status).toBe("paused");
    expect(after.lastError).toBeNull(); // tampoco se mete el message
    const events = mgr.listHistory(id);
    const suppressed = events.find(
      (e) =>
        e.event === "error" &&
        (e.data as Record<string, unknown> | null)?.suppressed === true,
    );
    expect(suppressed).toBeDefined();
  });

  it("markError DOES set 'error' from active states (armed/triggered/closing)", () => {
    const { id } = mgr.createTask(inputFixture());
    // El task arranca en 'idle'. Hacemos un update manual para simular un
    // estado activo sin pasar por startTask (que requiere vault unlocked).
    (mgr as unknown as { db: Db }).db
      .update(schema.tasks)
      .set({ status: "armed" })
      .run();
    // OJO: el set sin where afecta a TODAS las rows (de momento solo hay una).
    expect(mgr.getTask(id)!.status).toBe("armed");

    (mgr as unknown as { markError: (id: string, err: unknown) => void })
      .markError(id, new Error("boom"));

    expect(mgr.getTask(id)!.status).toBe("error");
    expect(mgr.getTask(id)!.lastError).toBe("boom");
  });

  it("markTriggered also respects user-decided statuses", () => {
    const { id } = mgr.createTask(inputFixture());
    mgr.pauseTask(id);

    (mgr as unknown as {
      markTriggered: (id: string, kind: "take_profit" | "stop_loss") => void;
    }).markTriggered(id, "take_profit");

    expect(mgr.getTask(id)!.status).toBe("paused");
  });

  it("markClosing also respects user-decided statuses", () => {
    const { id } = mgr.createTask(inputFixture());
    mgr.pauseTask(id);

    (mgr as unknown as { markClosing: (id: string) => void }).markClosing(id);

    expect(mgr.getTask(id)!.status).toBe("paused");
  });

  it("does not overwrite 'done' either", () => {
    // 'done' es un estado terminal: la posición se cerró, no queremos que un
    // retry tardío de verifyAndRecord pase la task a 'error' después.
    const { id } = mgr.createTask(inputFixture());
    (mgr as unknown as { db: Db }).db
      .update(schema.tasks)
      .set({ status: "done" })
      .run();

    (mgr as unknown as { markError: (id: string, err: unknown) => void })
      .markError(id, new Error("late verification failed"));

    expect(mgr.getTask(id)!.status).toBe("done");
  });
});

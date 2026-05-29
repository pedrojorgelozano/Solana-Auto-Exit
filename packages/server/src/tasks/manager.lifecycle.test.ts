import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

import * as schema from "../db/schema.js";
import type { Db } from "../db/client.js";
import { TaskManager } from "./manager.js";
import { WalletVault } from "../wallet/vault.js";
import type { CreateTaskInput } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

type Status = (typeof schema.tasks.$inferSelect)["status"];

/** Acceso a internos para inyectar estado sin red ni vault unlocked. */
interface Internals {
  db: Db;
  running: Map<string, { controller: AbortController }>;
}

function setStatus(mgr: TaskManager, id: string, status: Status): void {
  (mgr as unknown as Internals).db
    .update(schema.tasks)
    .set({ status })
    .where(eq(schema.tasks.id, id))
    .run();
}

function setCreatedAt(mgr: TaskManager, id: string, ms: number): void {
  (mgr as unknown as Internals).db
    .update(schema.tasks)
    .set({ createdAt: new Date(ms) })
    .where(eq(schema.tasks.id, id))
    .run();
}

describe("TaskManager.boot() re-pausa estados activos tras reinicio", () => {
  let mgr: TaskManager;

  beforeEach(() => {
    mgr = new TaskManager(newDb(), new WalletVault("/tmp/never-exists-vault"));
  });

  it("pasa idle/armed/triggered/closing a paused con history server-restart", async () => {
    const active: Status[] = ["idle", "armed", "triggered", "closing"];
    const ids = active.map((status) => {
      const { id } = mgr.createTask(inputFixture());
      setStatus(mgr, id, status);
      return id;
    });

    await mgr.boot();

    for (const id of ids) {
      const row = mgr.getTask(id)!;
      expect(row.status).toBe("paused");
      expect(row.lastError).toMatch(/Server restarted/i);
      const pausedEvent = mgr
        .listHistory(id)
        .find((e) => e.event === "paused");
      expect((pausedEvent?.data as { reason?: string })?.reason).toBe(
        "server-restart",
      );
    }
  });

  it("no toca estados terminales (done/stopped/error/paused)", async () => {
    const terminal: Status[] = ["done", "stopped", "error", "paused"];
    const ids = terminal.map((status) => {
      const { id } = mgr.createTask(inputFixture());
      setStatus(mgr, id, status);
      return id;
    });

    await mgr.boot();

    ids.forEach((id, i) => {
      expect(mgr.getTask(id)!.status).toBe(terminal[i]);
    });
  });

  it("es no-op sin tasks activas", async () => {
    const { id } = mgr.createTask(inputFixture());
    setStatus(mgr, id, "done");
    const before = mgr.listHistory(id).length;
    await mgr.boot();
    expect(mgr.listHistory(id).length).toBe(before); // no añadió eventos
  });
});

describe("TaskManager.pauseAllOnVaultLock()", () => {
  let mgr: TaskManager;

  beforeEach(() => {
    mgr = new TaskManager(newDb(), new WalletVault("/tmp/never-exists-vault"));
  });

  it("pausa las running, aborta sus controllers y registra vault-locked", () => {
    const { id } = mgr.createTask(inputFixture());
    setStatus(mgr, id, "armed");
    const controller = new AbortController();
    (mgr as unknown as Internals).running.set(id, { controller });

    mgr.pauseAllOnVaultLock();

    expect(mgr.getTask(id)!.status).toBe("paused");
    expect(mgr.getTask(id)!.lastError).toMatch(/Vault was locked/i);
    expect(controller.signal.aborted).toBe(true);
    expect((mgr as unknown as Internals).running.size).toBe(0);
    const ev = mgr.listHistory(id).find((e) => e.event === "paused");
    expect((ev?.data as { reason?: string })?.reason).toBe("vault-locked");
  });

  it("es no-op sin running", () => {
    const { id } = mgr.createTask(inputFixture());
    setStatus(mgr, id, "armed");
    mgr.pauseAllOnVaultLock();
    expect(mgr.getTask(id)!.status).toBe("armed"); // intacta
  });
});

describe("TaskManager — atomicidad (B-04) y cascada de history", () => {
  let mgr: TaskManager;

  beforeEach(() => {
    mgr = new TaskManager(newDb(), new WalletVault("/tmp/never-exists-vault"));
  });

  it("createTask hace rollback del insert si appendHistory falla", () => {
    // Si el insert del row y el del evento no estuvieran en la misma
    // transacción, la task quedaría persistida pese al fallo del history.
    (mgr as unknown as { appendHistory: () => void }).appendHistory = () => {
      throw new Error("history insert boom");
    };
    expect(() => mgr.createTask(inputFixture())).toThrow(/boom/);
    expect(mgr.listTasks()).toHaveLength(0); // rolled back
  });

  it("createTask emite exactamente un evento 'created'", () => {
    const { id } = mgr.createTask(inputFixture());
    const events = mgr.listHistory(id);
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe("created");
  });

  it("deleteTask borra el row y su history en cascada", () => {
    const { id } = mgr.createTask(inputFixture());
    expect(mgr.listHistory(id).length).toBeGreaterThan(0);
    mgr.deleteTask(id);
    expect(mgr.getTask(id)).toBeNull();
    expect(mgr.listHistory(id)).toHaveLength(0); // FK onDelete cascade
  });

  it("deleteAllTasks detiene running y vacía la tabla", () => {
    const ids = [0, 1, 2].map(() => mgr.createTask(inputFixture()).id);
    const controller = new AbortController();
    (mgr as unknown as Internals).running.set(ids[0]!, { controller });

    mgr.deleteAllTasks();

    expect(mgr.listTasks()).toHaveLength(0);
    expect(controller.signal.aborted).toBe(true);
    expect((mgr as unknown as Internals).running.size).toBe(0);
  });
});

describe("TaskManager — paginación e histórico", () => {
  let mgr: TaskManager;

  beforeEach(() => {
    mgr = new TaskManager(newDb(), new WalletVault("/tmp/never-exists-vault"));
  });

  it("historicalCounts cuenta done/stopped como completed y error aparte", () => {
    const statuses: Status[] = ["done", "done", "stopped", "error", "armed"];
    statuses.forEach((s) => {
      const { id } = mgr.createTask(inputFixture());
      setStatus(mgr, id, s);
    });
    expect(mgr.historicalCounts()).toEqual({ completed: 3, errors: 1 });
  });

  it("listHistoricalTasks pagina por cursor descendente sobre createdAt", () => {
    // 5 tasks done con createdAt escalonado (1000..5000).
    const ids: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const { id } = mgr.createTask(inputFixture());
      setStatus(mgr, id, "done");
      setCreatedAt(mgr, id, i * 1000);
      ids.push(id);
    }

    const page1 = mgr.listHistoricalTasks({ limit: 2 });
    expect(page1.map((r) => r.createdAt.getTime())).toEqual([5000, 4000]);

    const cursor = page1[page1.length - 1]!.createdAt.getTime();
    const page2 = mgr.listHistoricalTasks({ limit: 2, cursor });
    expect(page2.map((r) => r.createdAt.getTime())).toEqual([3000, 2000]);

    const page3 = mgr.listHistoricalTasks({
      limit: 2,
      cursor: page2[page2.length - 1]!.createdAt.getTime(),
    });
    expect(page3.map((r) => r.createdAt.getTime())).toEqual([1000]);
  });

  it("listHistoricalTasks respeta el filtro de status", () => {
    const statuses: Status[] = ["done", "stopped", "error"];
    statuses.forEach((s) => {
      const { id } = mgr.createTask(inputFixture());
      setStatus(mgr, id, s);
    });

    const errors = mgr.listHistoricalTasks({ limit: 50, filter: "errors" });
    expect(errors).toHaveLength(1);
    expect(errors[0]!.status).toBe("error");

    const completed = mgr.listHistoricalTasks({ limit: 50, filter: "completed" });
    expect(completed.map((r) => r.status).sort()).toEqual(["done", "stopped"]);
  });
});

describe("TaskManager.evaluateResumeCandidates (sin red)", () => {
  let mgr: TaskManager;

  beforeEach(() => {
    // Vault nunca desbloqueado → la rama de lectura de precio no toca red.
    mgr = new TaskManager(newDb(), new WalletVault("/tmp/never-exists-vault"));
  });

  function pauseSystem(id: string, lastError: string): void {
    (mgr as unknown as Internals).db
      .update(schema.tasks)
      .set({ status: "paused", lastError })
      .where(eq(schema.tasks.id, id))
      .run();
  }

  it("solo incluye paused-por-sistema; con vault locked salen como priceError", async () => {
    const sys = mgr.createTask(inputFixture()).id;
    pauseSystem(sys, "Vault was locked while running.");
    const userPaused = mgr.createTask(inputFixture()).id;
    setStatus(mgr, userPaused, "paused"); // lastError null → pausa de usuario
    const armed = mgr.createTask(inputFixture()).id;
    setStatus(mgr, armed, "armed");

    const candidates = await mgr.evaluateResumeCandidates();

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.id).toBe(sys);
    expect(candidates[0]!.priceError).toMatch(/locked/i);
    expect(candidates[0]!.currentPrice).toBeNull();
    expect(candidates[0]!.crossed).toBe(false); // nunca "seguro" sin precio real
  });

  it("devuelve [] cuando no hay paused-por-sistema", async () => {
    const done = mgr.createTask(inputFixture()).id;
    setStatus(mgr, done, "done");
    expect(await mgr.evaluateResumeCandidates()).toEqual([]);
  });
});

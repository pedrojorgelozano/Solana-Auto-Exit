import { randomUUID } from "node:crypto";
import { eq, inArray, desc } from "drizzle-orm";

import {
  makeAdapter,
  withRetry,
  log,
  logError,
  type BaseConfig,
  type ProtocolAdapter,
  type ResolvedPosition,
  type CloseResult,
} from "@solana-auto-exit/engine";

import type { Db } from "../db/client.js";
import { tasks, history, type TaskRow } from "../db/schema.js";
import type { WalletVault } from "../wallet/vault.js";
import type { CreateTaskInput, TaskEvent } from "./types.js";
import { verifyTxBalances } from "./verify.js";

/**
 * Estados que el TaskManager considera "activos" — son los que se deberían
 * estar ejecutando si el server está sano y la vault desbloqueada. Al hacer
 * boot del server, estas tasks se pasan a "paused" para que el usuario las
 * resuma manualmente tras desbloquear el vault.
 */
const ACTIVE_STATES = ["idle", "armed", "triggered", "closing"] as const;

interface RunningEntry {
  controller: AbortController;
  /** Cache del último precio leído (para que la UI lo pinte sin tocar el RPC). */
  lastPrice: number | null;
  lastTickAt: number | null;
  /**
   * Time-buffer cronómetro (ADR-025). Timestamp ms del primer tick en que
   * el precio cruzó el target. null = no está cruzado o no hay buffer. Reset
   * duro: si en un tick posterior el precio sale de la zona del trigger,
   * volvemos a null. In-memory: al reiniciar el server se borra (decisión
   * conservadora — la task vuelve de paused tras unlock con buffer fresco).
   */
  tpFirstCrossedAt: number | null;
  slFirstCrossedAt: number | null;
}

export class TaskManager {
  private readonly running = new Map<string, RunningEntry>();

  constructor(
    private readonly db: Db,
    private readonly vault: WalletVault,
  ) {}

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Al arrancar el server, pasamos a "paused" todas las tasks que estaban
   * activas (porque el vault está locked tras un reboot y nadie puede firmar).
   * El user las resume manualmente desde la UI tras hacer unlock.
   */
  async boot(): Promise<void> {
    const stale = this.db
      .select()
      .from(tasks)
      .where(inArray(tasks.status, [...ACTIVE_STATES]))
      .all();
    if (stale.length === 0) return;
    log(`[tasks] boot: pausando ${stale.length} task(s) activas tras reinicio`);
    for (const row of stale) {
      this.db
        .update(tasks)
        .set({
          status: "paused",
          updatedAt: new Date(),
          lastError: "Server restarted; resume after unlocking the vault.",
        })
        .where(eq(tasks.id, row.id))
        .run();
      this.appendHistory(row.id, "paused", {
        reason: "server-restart",
      });
    }
  }

  /**
   * Al apagar el server, abortamos cualquier loop en vuelo (la tx que esté
   * "in flight" se queda en el RPC; al reiniciar la vemos por estado on-chain).
   */
  shutdown(): void {
    for (const [id, entry] of this.running.entries()) {
      entry.controller.abort();
      log(`[tasks] shutdown: aborted task ${id}`);
    }
    this.running.clear();
  }

  // ===========================================================================
  // CRUD
  // ===========================================================================

  createTask(input: CreateTaskInput): { id: string } {
    const id = randomUUID();
    this.db
      .insert(tasks)
      .values({
        id,
        protocol: input.protocol,
        network: input.network,
        rpcUrl: input.rpcUrl,
        positionId: input.positionId,
        protocolConfig: input.protocolConfig,
        takeProfitPrice: input.takeProfitPrice ?? null,
        stopLossPrice: input.stopLossPrice ?? null,
        takeProfitBufferMs: input.takeProfitBufferMs ?? null,
        stopLossBufferMs: input.stopLossBufferMs ?? null,
        slippageBps: input.slippageBps,
        pollMs: input.pollMs,
        dryRun: input.dryRun,
        exitTokenMint: input.exitTokenMint ?? null,
        exitSwapSlippageBps: input.exitSwapSlippageBps,
        status: "idle",
      })
      .run();
    this.appendHistory(id, "created", {
      protocol: input.protocol,
      positionId: input.positionId,
    });
    return { id };
  }

  listTasks(): TaskRow[] {
    return this.db
      .select()
      .from(tasks)
      .orderBy(desc(tasks.createdAt))
      .all();
  }

  getTask(id: string): TaskRow | null {
    const row = this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .get();
    return row ?? null;
  }

  /**
   * Estado en memoria de una task (precio actual, cronómetros de buffer, etc.).
   * Si no está corriendo, todos los campos vienen a null. La UI usa
   * tp/slFirstCrossedAt + el bufferMs del row para pintar "X de Y" en vivo.
   */
  getRunningSnapshot(id: string): {
    isRunning: boolean;
    lastPrice: number | null;
    lastTickAt: number | null;
    tpFirstCrossedAt: number | null;
    slFirstCrossedAt: number | null;
  } {
    const entry = this.running.get(id);
    if (!entry) {
      return {
        isRunning: false,
        lastPrice: null,
        lastTickAt: null,
        tpFirstCrossedAt: null,
        slFirstCrossedAt: null,
      };
    }
    return {
      isRunning: true,
      lastPrice: entry.lastPrice,
      lastTickAt: entry.lastTickAt,
      tpFirstCrossedAt: entry.tpFirstCrossedAt,
      slFirstCrossedAt: entry.slFirstCrossedAt,
    };
  }

  // ===========================================================================
  // Control: start / pause / stop / delete
  // ===========================================================================

  startTask(id: string): void {
    if (!this.vault.isUnlocked()) {
      throw new Error("Vault is locked. Unlock it first.");
    }
    if (this.running.has(id)) {
      throw new Error("Task is already running.");
    }
    const row = this.getTask(id);
    if (!row) throw new Error(`Task ${id} not found.`);
    if (row.status === "done") {
      throw new Error("Task is already done.");
    }
    if (row.status === "closing" || row.status === "triggered") {
      throw new Error(`Task is in transient state ${row.status}.`);
    }

    const controller = new AbortController();
    const entry: RunningEntry = {
      controller,
      lastPrice: null,
      lastTickAt: null,
      tpFirstCrossedAt: null,
      slFirstCrossedAt: null,
    };
    this.running.set(id, entry);

    this.db
      .update(tasks)
      .set({ status: "armed", lastError: null, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .run();

    const eventName = row.status === "paused" ? "resumed" : "started";
    this.appendHistory(id, eventName, {});

    // Lanzamos el watcher en segundo plano. Cualquier error se captura aquí
    // (runWatcher solo debe lanzar si hay un bug, los errores funcionales
    // los marca él mismo como status="error").
    this.runWatcher(row, entry).catch((err) => {
      logError(`[tasks] watcher ${id} crashed`, err);
    });
  }

  pauseTask(id: string): void {
    this.stopRunning(id);
    const row = this.getTask(id);
    if (!row) throw new Error(`Task ${id} not found.`);
    if (row.status === "done" || row.status === "stopped") return;
    this.db
      .update(tasks)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .run();
    this.appendHistory(id, "paused", { reason: "user" });
  }

  stopTask(id: string): void {
    this.stopRunning(id);
    const row = this.getTask(id);
    if (!row) throw new Error(`Task ${id} not found.`);
    if (row.status === "done") {
      throw new Error("Cannot stop a task that is already done.");
    }
    this.db
      .update(tasks)
      .set({ status: "stopped", updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .run();
    this.appendHistory(id, "stopped", {});
  }

  deleteTask(id: string): void {
    this.stopRunning(id);
    // history se borra en cascada por la FK del schema.
    this.db.delete(tasks).where(eq(tasks.id, id)).run();
  }

  /**
   * Cuando el vault se locked manualmente, todas las tasks armed/triggered/etc.
   * se pausan. El user puede resumirlas tras desbloquear.
   */
  pauseAllOnVaultLock(): void {
    if (this.running.size === 0) return;
    log(
      `[tasks] vault locked: pausando ${this.running.size} task(s) en ejecución`,
    );
    for (const id of [...this.running.keys()]) {
      this.stopRunning(id);
      this.db
        .update(tasks)
        .set({
          status: "paused",
          updatedAt: new Date(),
          lastError: "Vault was locked while running.",
        })
        .where(eq(tasks.id, id))
        .run();
      this.appendHistory(id, "paused", { reason: "vault-locked" });
    }
  }

  private stopRunning(id: string): void {
    const entry = this.running.get(id);
    if (entry) {
      entry.controller.abort();
      this.running.delete(id);
    }
  }

  // ===========================================================================
  // Watcher loop
  // ===========================================================================

  private async runWatcher(row: TaskRow, entry: RunningEntry): Promise<void> {
    const { signal } = entry.controller;
    let adapter: ProtocolAdapter | undefined;
    let position: ResolvedPosition | undefined;

    try {
      adapter = makeAdapter(row.protocol);
      const wallet = this.vault.getKeypair(); // re-comprobado al usar
      // F6.2.b: pasamos también el raw secret para que adapters que lo
      // necesiten (Meteora) puedan construir un Keypair de web3.js v1.
      // Orca lo ignora. Ver ADR-024.
      const rawSecret = this.vault.getRawSecret();
      const base: BaseConfig = this.toBaseConfig(row);
      await adapter.init(base, row.protocolConfig, wallet, rawSecret);
      position = await adapter.resolvePosition();
    } catch (err) {
      this.markError(row.id, err);
      return;
    }

    const tpDesc =
      row.takeProfitPrice !== null ? `TP≥${row.takeProfitPrice}` : "TP—";
    const slDesc =
      row.stopLossPrice !== null ? `SL≤${row.stopLossPrice}` : "SL—";
    const tpBufDesc = row.takeProfitBufferMs ? ` buf=${row.takeProfitBufferMs}ms` : "";
    const slBufDesc = row.stopLossBufferMs ? ` buf=${row.stopLossBufferMs}ms` : "";
    log(
      `[tasks] ${row.id} armed: ${position.poolLabel} ${tpDesc}${tpBufDesc} ${slDesc}${slBufDesc} pollMs=${row.pollMs}`,
    );

    while (!signal.aborted) {
      // --- Tick: leer precio ---
      let price: number;
      try {
        price = await adapter.getPrice(position);
      } catch (err) {
        logError(`[tasks] ${row.id} tick failed (will retry next cycle)`, err);
        await this.sleepAbortable(row.pollMs, signal);
        continue;
      }

      const now = Date.now();
      entry.lastPrice = price;
      entry.lastTickAt = now;

      // --- Evaluar triggers (TP + SL) con time buffer (ADR-025) ---
      // Cada trigger pasa por una máquina de estados de 3 ramas:
      //   (a) precio en zona + sin buffer configurado → ready inmediato
      //   (b) precio en zona + buffer configurado → arma o avanza cronómetro,
      //       solo ready cuando han pasado bufferMs continuos
      //   (c) precio fuera de zona → reset duro del cronómetro
      const tpHit =
        row.takeProfitPrice !== null && price >= row.takeProfitPrice;
      const slHit =
        row.stopLossPrice !== null && price <= row.stopLossPrice;

      const tpReady = this.evalBuffer(
        row.id,
        "take_profit",
        tpHit,
        row.takeProfitBufferMs,
        entry,
        now,
      );
      const slReady = this.evalBuffer(
        row.id,
        "stop_loss",
        slHit,
        row.stopLossBufferMs,
        entry,
        now,
      );

      if (!tpReady && !slReady) {
        await this.sleepAbortable(row.pollMs, signal);
        continue;
      }

      // Guard race pause/abort vs trigger: si entre `await getPrice` y aquí
      // alguien llamó pauseTask/stopTask/pauseAllOnVaultLock, el row ya está
      // en `paused`/`stopped`/etc. en la DB. Disparar el cierre ahora
      // sobrescribiría ese estado con `closing`/`done`/`error`, ignorando
      // la intención del usuario. El abort es la señal canónica de "no hagas
      // nada más en este watcher".
      if (signal.aborted) return;

      // Si por azar los dos están listos en el mismo tick (rango entre
      // SL y TP atravesado y ambos buffers cumplidos), priorizamos take-profit.
      const triggeredBy: "take_profit" | "stop_loss" = tpReady
        ? "take_profit"
        : "stop_loss";

      // --- Trigger: cierre + (swap opcional) ---
      this.markTriggered(row.id, triggeredBy);
      await this.executeClose(row, adapter, position, signal);
      this.running.delete(row.id);
      return;
    }

    log(`[tasks] ${row.id} watcher aborted (paused or stopped)`);
  }

  private async executeClose(
    row: TaskRow,
    adapter: ProtocolAdapter,
    position: ResolvedPosition,
    signal: AbortSignal,
  ): Promise<void> {
    this.markClosing(row.id);

    let closeResult: CloseResult;
    try {
      closeResult = await withRetry(
        () => adapter.closePosition(position, row.slippageBps, row.dryRun),
        {
          maxAttempts: 5,
          baseMs: 1000,
          label: `${row.protocol}.closePosition`,
        },
      );
    } catch (err) {
      this.markError(row.id, err);
      return;
    }

    this.db
      .update(tasks)
      .set({
        closeResult: closeResult as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, row.id))
      .run();
    this.appendHistory(row.id, "closed", closeResult as unknown as Record<string, unknown>);

    // Verificación on-chain del close: best-effort, fire-and-forget pero
    // awaited para que el evento `verified` quede registrado antes del swap.
    if (
      !row.dryRun &&
      typeof (closeResult as { txId?: unknown }).txId === "string"
    ) {
      await this.verifyAndRecord(
        row,
        (closeResult as { txId: string }).txId,
        "close",
        closeResult as unknown as Record<string, unknown>,
      );
    }

    // El close ya está hecho y verified. Si nos pausaron entre el close y
    // el swap opcional, NO disparamos el swap: la task cae al `done` de
    // abajo con closeResult guardado y sin swapResult. El usuario decide
    // manualmente si quiere mover los fondos recuperados a otro token.
    if (row.exitTokenMint && !signal.aborted) {
      try {
        const swapResult = await withRetry(
          () =>
            adapter.swapToExit(
              position,
              row.exitTokenMint!,
              closeResult,
              row.exitSwapSlippageBps,
              row.dryRun,
            ),
          {
            maxAttempts: 5,
            baseMs: 1000,
            label: `${row.protocol}.swapToExit`,
          },
        );
        this.db
          .update(tasks)
          .set({
            swapResult: swapResult as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, row.id))
          .run();
        this.appendHistory(row.id, "swapped", swapResult as unknown as Record<string, unknown>);

        if (
          !row.dryRun &&
          typeof (swapResult as { txId?: unknown }).txId === "string"
        ) {
          await this.verifyAndRecord(
            row,
            (swapResult as { txId: string }).txId,
            "swap",
            swapResult as unknown as Record<string, unknown>,
          );
        }
      } catch (err) {
        // El close YA está hecho. Marcamos error pero indicamos que el close
        // sí salió bien — al user le aparecerá la task en estado "error" con
        // el closeResult presente para auditoría.
        this.markError(row.id, err, /* preserveCloseResult */ true);
        return;
      }
    }

    this.db
      .update(tasks)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(tasks.id, row.id))
      .run();
  }

  /**
   * Time buffer state machine (ADR-025). Devuelve true si el trigger debe
   * disparar el cierre en este tick. Muta `entry` con el timestamp del primer
   * cruce y emite eventos `buffer_armed` / `buffer_reset` para el timeline.
   *
   * - `inZone=true` + sin buffer → ready inmediato (comportamiento legacy).
   * - `inZone=true` + buffer + sin cronómetro → arma cronómetro, no ready aún.
   * - `inZone=true` + buffer + cronómetro vivo → ready cuando han pasado bufferMs.
   * - `inZone=false` + cronómetro vivo → reset duro a null. No ready.
   */
  private evalBuffer(
    taskId: string,
    kind: "take_profit" | "stop_loss",
    inZone: boolean,
    bufferMs: number | null,
    entry: RunningEntry,
    now: number,
  ): boolean {
    const slot = kind === "take_profit" ? "tpFirstCrossedAt" : "slFirstCrossedAt";
    const current = entry[slot];

    if (!inZone) {
      if (current !== null) {
        entry[slot] = null;
        this.appendHistory(taskId, "buffer_reset", { kind });
      }
      return false;
    }

    // En zona. Sin buffer = dispara inmediato.
    if (!bufferMs || bufferMs <= 0) return true;

    if (current === null) {
      entry[slot] = now;
      this.appendHistory(taskId, "buffer_armed", { kind, bufferMs });
      return false;
    }

    return now - current >= bufferMs;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * BaseConfig que recibe el adapter en init(). Los campos targetPrice y
   * direction son legacy del path CLI; el adapter NO los usa internamente
   * (solo cachea protocolConfig, RPC y wallet). Pasamos placeholders válidos
   * para satisfacer el tipo. El watcher loop evalúa los triggers reales
   * (TP/SL) directamente desde row, no desde BaseConfig.
   */
  private toBaseConfig(row: TaskRow): BaseConfig {
    return {
      protocol: row.protocol,
      network: row.network,
      rpcUrl: row.rpcUrl,
      targetPrice: 0,
      direction: "above",
      slippageBps: row.slippageBps,
      pollMs: row.pollMs,
      walletPath: "",
      dryRun: row.dryRun,
      exitTokenMint: row.exitTokenMint ?? undefined,
      exitSwapSlippageBps: row.exitSwapSlippageBps,
    };
  }

  private markTriggered(
    id: string,
    triggeredBy: "take_profit" | "stop_loss",
  ): void {
    this.db
      .update(tasks)
      .set({
        status: "triggered",
        triggeredBy,
        triggeredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .run();
    this.appendHistory(id, "triggered", { triggeredBy });
  }

  private markClosing(id: string): void {
    this.db
      .update(tasks)
      .set({ status: "closing", updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .run();
  }

  private markError(
    id: string,
    err: unknown,
    _preserveCloseResult = false,
  ): void {
    const msg = err instanceof Error ? err.message : String(err);
    this.db
      .update(tasks)
      .set({
        status: "error",
        lastError: msg,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .run();
    this.appendHistory(id, "error", { message: msg });
  }

  /**
   * Best-effort on-chain verification post-tx. Queryamos getTransaction al
   * RPC, parseamos pre/post balances de la bot wallet y emitimos un evento
   * `verified` con quoted vs actual. No-op si la wallet está locked o si
   * el RPC no devuelve la tx a tiempo — solo loguea y continúa.
   */
  private async verifyAndRecord(
    row: TaskRow,
    signature: string,
    kind: "close" | "swap",
    quoted: Record<string, unknown>,
  ): Promise<void> {
    let owner: string;
    try {
      owner = this.vault.getKeypair().address;
    } catch {
      // Vault locked entre el cierre y la verificación — saltamos.
      return;
    }
    try {
      const deltas = await verifyTxBalances(row.rpcUrl, signature, owner);
      this.appendHistory(row.id, "verified", {
        kind,
        signature,
        fee: deltas.fee.toString(),
        solDelta: deltas.solDelta.toString(),
        tokenDeltas: Object.fromEntries(
          Object.entries(deltas.tokenDeltas).map(([m, v]) => [m, v.toString()]),
        ),
        quoted,
      });
    } catch (err) {
      logError(`[tasks] ${row.id} on-chain verification failed`, err);
      // Non-fatal — el task ya está en `done`/`error` por otra vía.
    }
  }

  /**
   * Lista los eventos de history para una task, más recientes primero.
   * Se usa para el timeline en `/tasks/[id]`.
   */
  listHistory(taskId: string): Array<{
    id: string;
    taskId: string;
    timestamp: Date;
    event: string;
    data: unknown;
  }> {
    return this.db
      .select()
      .from(history)
      .where(eq(history.taskId, taskId))
      .orderBy(desc(history.timestamp))
      .all();
  }

  private appendHistory(
    taskId: string,
    event: TaskEvent,
    data: Record<string, unknown>,
  ): void {
    this.db
      .insert(history)
      .values({
        id: randomUUID(),
        taskId,
        event,
        data,
      })
      .run();
  }

  private sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = (): void => {
        clearTimeout(timer);
        resolve();
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}

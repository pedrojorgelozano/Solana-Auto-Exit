import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * Watch-task. Una fila por posición que el bot está vigilando.
 * Persistente: al reiniciar el server, se reanudan las que estén en estado activo.
 */
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),

  // Identificación de la posición y red
  protocol: text("protocol").notNull(),
  network: text("network", { enum: ["mainnet", "devnet"] }).notNull(),
  rpcUrl: text("rpc_url").notNull(),
  positionId: text("position_id").notNull(),
  /** Config específica del adapter (Orca: positionMint + decimals A/B). JSON. */
  protocolConfig: text("protocol_config", { mode: "json" }).notNull(),

  // Triggers — al menos uno de los dos debe estar definido (validación en
  // app layer; SQLite no soporta CHECK constraints via Drizzle out-of-box).
  /** Precio a partir del cual se cierra como take-profit (price ≥ TP). */
  takeProfitPrice: real("take_profit_price"),
  /** Precio a partir del cual se cierra como stop-loss (price ≤ SL). */
  stopLossPrice: real("stop_loss_price"),
  /**
   * Time buffer del TP: el precio tiene que mantenerse por encima del target
   * durante este tiempo (ms) antes de disparar. Null o 0 = sin buffer (dispara
   * en el primer tick que cruza). Reset duro: si el precio sale de la zona,
   * el cronómetro vuelve a cero. Ver ADR-025.
   */
  takeProfitBufferMs: integer("take_profit_buffer_ms"),
  /** Idem TP, para stop-loss (precio debe mantenerse por debajo). */
  stopLossBufferMs: integer("stop_loss_buffer_ms"),
  /** Cuál de los dos disparó el cierre. Se rellena al disparar. */
  triggeredBy: text("triggered_by", {
    enum: ["take_profit", "stop_loss"],
  }),

  slippageBps: integer("slippage_bps").notNull(),
  pollMs: integer("poll_ms").notNull(),
  dryRun: integer("dry_run", { mode: "boolean" }).notNull(),

  // Exit swap opcional
  exitTokenMint: text("exit_token_mint"),
  exitSwapSlippageBps: integer("exit_swap_slippage_bps").notNull(),

  // Estado
  status: text("status", {
    enum: [
      "idle",
      "armed",
      "triggered",
      "closing",
      "done",
      "error",
      "paused",
      "stopped",
    ],
  })
    .notNull()
    .default("idle"),

  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  triggeredAt: integer("triggered_at", { mode: "timestamp_ms" }),

  // Resultados (rellenos al cerrar)
  closeResult: text("close_result", { mode: "json" }),
  swapResult: text("swap_result", { mode: "json" }),
  lastError: text("last_error"),
});

/**
 * Eventos de la vida de una task. Útil para histórico, debugging y dashboard.
 */
export const history = sqliteTable("history", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  timestamp: integer("timestamp", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  /** "started" | "ticked" | "triggered" | "closed" | "swapped" | "error" | "paused" | "resumed" | "stopped" */
  event: text("event").notNull(),
  /** Payload del evento (precio, tx, mensaje, etc.). JSON. */
  data: text("data", { mode: "json" }),
});

/**
 * Ajustes globales del servidor (RPC, slippage por defecto, etc.).
 * Clave/valor para no tener que migrar al añadir nuevas keys.
 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
export type HistoryRow = typeof history.$inferSelect;
export type NewHistoryRow = typeof history.$inferInsert;

import type { Network } from "@solana-auto-exit/engine";

/**
 * Input para crear un auto-exit. Lo que la UI le manda al backend.
 * El backend valida con zod (al menos uno de TP/SL definido) y persiste
 * en la tabla `tasks`.
 */
export interface CreateTaskInput {
  protocol: string;
  network: Network;
  rpcUrl: string;
  /** Identificador legible de la posición (p. ej. mint del NFT en Orca). */
  positionId: string;
  /** Config específica del adapter (Orca: positionMint + decimals A/B). */
  protocolConfig: Record<string, unknown>;

  /** Take-profit: precio ≥ TP dispara cierre. Null si no se quiere TP. */
  takeProfitPrice?: number | null;
  /** Stop-loss: precio ≤ SL dispara cierre. Null si no se quiere SL. */
  stopLossPrice?: number | null;

  slippageBps: number;
  pollMs: number;
  dryRun: boolean;

  exitTokenMint?: string;
  exitSwapSlippageBps: number;
}

export type TaskStatus =
  | "idle"
  | "armed"
  | "triggered"
  | "closing"
  | "done"
  | "error"
  | "paused"
  | "stopped";

export type TaskEvent =
  | "created"
  | "started"
  | "triggered"
  | "closed"
  | "swapped"
  | "error"
  | "paused"
  | "resumed"
  | "stopped";

/** Qué trigger disparó un cierre. Lo registramos en task.triggeredBy. */
export type TriggerKind = "take_profit" | "stop_loss";

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
  /**
   * Time buffer del TP en ms: el precio debe mantenerse por encima del target
   * durante este tiempo antes de disparar (ADR-025). Null o 0 = sin buffer.
   */
  takeProfitBufferMs?: number | null;
  /** Idem TP, para stop-loss. */
  stopLossBufferMs?: number | null;

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
  | "verified"
  | "error"
  | "paused"
  | "resumed"
  | "stopped"
  | "buffer_armed"
  | "buffer_reset";

/** Qué trigger disparó un cierre. Lo registramos en task.triggeredBy. */
export type TriggerKind = "take_profit" | "stop_loss";

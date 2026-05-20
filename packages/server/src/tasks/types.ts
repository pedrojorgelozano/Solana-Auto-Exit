import type { Direction, Network } from "@solana-auto-exit/engine";

/**
 * Input para crear una watch-task. Lo que la UI le manda al backend.
 * El backend valida con zod y persiste en la tabla `tasks`.
 */
export interface CreateTaskInput {
  protocol: string;
  network: Network;
  rpcUrl: string;
  /** Identificador legible de la posición (p. ej. mint del NFT en Orca). */
  positionId: string;
  /** Config específica del adapter (Orca: positionMint + decimals A/B). */
  protocolConfig: Record<string, unknown>;

  targetPrice: number;
  direction: Direction;
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

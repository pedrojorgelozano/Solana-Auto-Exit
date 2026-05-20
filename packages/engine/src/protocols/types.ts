import type { KeyPairSigner } from "@solana/kit";

// =============================================================================
// Common types
// =============================================================================

export type Network = "mainnet" | "devnet";

export type Direction = "above" | "below";

/**
 * Subset of BaseConfig needed for read-only operations (no wallet, no target).
 * Used by the UI flow: connect → list positions → inspect summaries, before
 * any task/watcher is created.
 */
export interface BaseReadOnlyConfig {
  network: Network;
  rpcUrl: string;
}

/**
 * Full config for a watch-task (CLI today, one task in the server later).
 */
export interface BaseConfig extends BaseReadOnlyConfig {
  protocol: string;
  targetPrice: number;
  direction: Direction;
  slippageBps: number;
  pollMs: number;
  walletPath: string;
  dryRun: boolean;
  exitTokenMint?: string;
  exitSwapSlippageBps: number;
}

// =============================================================================
// Position discovery (UI-facing)
// =============================================================================

export interface TokenInfo {
  mint: string;
  /** Best-effort symbol if known by the adapter. May be undefined. */
  symbol?: string;
  decimals: number;
}

/**
 * Light reference to a position. Returned by listOwnedPositions().
 * The adapter knows how to interpret `id` (NFT mint, position address, etc.).
 */
export interface PositionRef {
  protocol: string;
  id: string;
  /** Human-readable label, e.g. "SOL / devUSDC 0.2%". */
  label: string;
  /** Pool/pair identifier (address as string). */
  poolId: string;
}

export interface PositionRange {
  min: number;
  max: number;
}

export interface PositionLiquidity {
  /** bigint serialized as decimal string (UI converts to decimal using TokenInfo.decimals). */
  tokenA: string;
  tokenB: string;
}

/**
 * Detailed snapshot of a position for the position card / detail view.
 */
export interface PositionSummary {
  ref: PositionRef;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  /** Price expressed as tokenB per tokenA, decimal. */
  currentPrice: number;
  range: PositionRange;
  isInRange: boolean;
  /** What the position currently holds. */
  liquidity: PositionLiquidity;
  /** Accumulated fees not yet collected (if applicable). */
  feesPending?: PositionLiquidity;
}

// =============================================================================
// Config schema (UI form rendering)
// =============================================================================

export type ConfigFieldType =
  | "string"
  | "number"
  | "integer"
  | "address"
  | "boolean"
  | "enum";

/**
 * Declarative description of a single config field. The UI reads the
 * adapter's schema and renders the form without hardcoding any protocol.
 */
export interface ConfigField {
  /** Env var name (also used as form field id). */
  key: string;
  /** Human-readable label for the UI. */
  label: string;
  type: ConfigFieldType;
  required: boolean;
  description?: string;
  defaultValue?: string | number | boolean;
  /** For enum types. */
  options?: string[];
  /** For number / integer. */
  min?: number;
  max?: number;
  /** Optional grouping for UI rendering. */
  group?: string;
}

export interface ConfigSchema {
  protocol: string;
  fields: ConfigField[];
}

// =============================================================================
// Price history (UI sparklines, optional)
// =============================================================================

export type PriceWindow = "1h" | "6h" | "24h" | "7d";

export interface PricePoint {
  /** Unix seconds. */
  timestamp: number;
  price: number;
}

// =============================================================================
// Watcher lifecycle types (CLI compat + server tasks)
// =============================================================================

export interface ResolvedPosition {
  id: string;
  poolLabel: string;
  raw: unknown;
}

export interface CloseResult {
  dryRun: boolean;
  txId?: string;
  estimatedTokenA?: string;
  estimatedTokenB?: string;
  feesTokenA?: string;
  feesTokenB?: string;
  notes?: string;
}

export interface SwapExitResult {
  dryRun: boolean;
  skipped: boolean;
  txId?: string;
  fromMint?: string;
  inputAmount?: string;
  estimatedOutput?: string;
  minimumOutput?: string;
  notes?: string;
}

// =============================================================================
// Contract
// =============================================================================

export interface ProtocolAdapter {
  /** Internal name used in registry and env vars (`"orca"`, `"meteora"`). */
  readonly name: string;
  /** Human-readable name for the UI (`"Orca Whirlpools"`). */
  readonly displayName: string;

  // ---------------------------------------------------------------------------
  // Schema + setup (no wallet required)
  // ---------------------------------------------------------------------------

  /**
   * Static schema describing the protocol-specific env / form fields.
   * Pure: can be called any time, no I/O.
   */
  getConfigSchema(): ConfigSchema;

  /**
   * Initialize RPC + SDK state for read-only operations. Idempotent.
   * Required before listOwnedPositions / getPositionSummary / getPriceHistory.
   */
  setupRpc(common: BaseReadOnlyConfig): Promise<void>;

  /**
   * Attach a wallet for signing operations (closePosition / swapToExit).
   * setupRpc() must have been called first.
   */
  attachWallet(wallet: KeyPairSigner): void;

  // ---------------------------------------------------------------------------
  // Discovery (read-only; requires setupRpc)
  // ---------------------------------------------------------------------------

  /** Enumerate positions of this protocol owned by the wallet address. */
  listOwnedPositions(owner: string): Promise<PositionRef[]>;

  /** Full snapshot for a position (used by the position card). */
  getPositionSummary(ref: PositionRef): Promise<PositionSummary>;

  /** Optional sparkline data. Adapters that don't have a source can omit. */
  getPriceHistory?(ref: PositionRef, window: PriceWindow): Promise<PricePoint[]>;

  // ---------------------------------------------------------------------------
  // CLI-style lifecycle (kept for backwards compat with packages/cli)
  // ---------------------------------------------------------------------------

  /**
   * Parse protocol-specific env vars into a typed config object.
   * Used by the CLI to assemble a watch-task from `.env`.
   */
  loadProtocolConfig(env: NodeJS.ProcessEnv): unknown;

  /**
   * One-shot init for the CLI path. Equivalent to:
   *   await setupRpc(common); attachWallet(wallet); + cache protocolConfig
   * for use by resolvePosition().
   */
  init(
    common: BaseConfig,
    protocolConfig: unknown,
    wallet: KeyPairSigner,
  ): Promise<void>;

  resolvePosition(): Promise<ResolvedPosition>;

  // ---------------------------------------------------------------------------
  // Watcher operations
  // ---------------------------------------------------------------------------

  getPrice(position: ResolvedPosition): Promise<number>;

  closePosition(
    position: ResolvedPosition,
    slippageBps: number,
    dryRun: boolean,
  ): Promise<CloseResult>;

  swapToExit(
    position: ResolvedPosition,
    exitTokenMint: string,
    closeResult: CloseResult,
    slippageBps: number,
    dryRun: boolean,
  ): Promise<SwapExitResult>;
}

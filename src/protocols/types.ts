import type { KeyPairSigner } from "@solana/kit";

export type Direction = "above" | "below";

export interface BaseConfig {
  protocol: string;
  network: "mainnet" | "devnet";
  rpcUrl: string;
  targetPrice: number;
  direction: Direction;
  slippageBps: number;
  pollMs: number;
  walletPath: string;
  dryRun: boolean;
  exitTokenMint?: string;
  exitSwapSlippageBps: number;
}

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

export interface ProtocolAdapter {
  readonly name: string;

  loadProtocolConfig(env: NodeJS.ProcessEnv): unknown;

  init(
    common: BaseConfig,
    protocolConfig: unknown,
    wallet: KeyPairSigner,
  ): Promise<void>;

  resolvePosition(): Promise<ResolvedPosition>;

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

import {
  setRpc,
  setDefaultFunder,
  closePosition,
  swap,
} from "@orca-so/whirlpools";
import {
  getPositionAddress,
  fetchPosition,
  fetchWhirlpool,
  WhirlpoolDeployment,
} from "@orca-so/whirlpools-client";
import { sqrtPriceToPrice } from "@orca-so/whirlpools-core";
import {
  address,
  type Address,
  type KeyPairSigner,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";

import type {
  BaseConfig,
  BaseReadOnlyConfig,
  CloseResult,
  ConfigSchema,
  PositionRef,
  PositionSummary,
  ProtocolAdapter,
  ResolvedPosition,
  SwapExitResult,
} from "../types.js";
import { loadOrcaConfig, type OrcaConfig } from "./config.js";

interface OrcaRawPosition {
  positionMint: Address;
  positionAddress: Address;
  poolAddress: Address;
  decimalsA: number;
  decimalsB: number;
}

const ORCA_CONFIG_SCHEMA: ConfigSchema = {
  protocol: "orca",
  fields: [
    {
      key: "ORCA_POSITION_MINT",
      label: "Position NFT mint",
      type: "address",
      required: true,
      description:
        "Mint of the Whirlpool position NFT (Token-2022). You can find it in your wallet or by inspecting the open-position transaction on Solscan.",
      group: "Position",
    },
    {
      key: "ORCA_DECIMALS_A",
      label: "Token A decimals",
      type: "integer",
      required: true,
      description:
        "Decimals of the first token in the pool (SOL = 9, USDC = 6).",
      min: 0,
      max: 18,
      defaultValue: 9,
      group: "Position",
    },
    {
      key: "ORCA_DECIMALS_B",
      label: "Token B decimals",
      type: "integer",
      required: true,
      description: "Decimals of the second token in the pool.",
      min: 0,
      max: 18,
      defaultValue: 6,
      group: "Position",
    },
  ],
};

export class OrcaAdapter implements ProtocolAdapter {
  readonly name = "orca";
  readonly displayName = "Orca Whirlpools";

  private rpc?: Rpc<SolanaRpcApi>;
  private wallet?: KeyPairSigner;
  private deployment?: typeof WhirlpoolDeployment.devnet;
  private orcaConfig?: OrcaConfig;

  // ---------------------------------------------------------------------------
  // Schema + setup
  // ---------------------------------------------------------------------------

  getConfigSchema(): ConfigSchema {
    return ORCA_CONFIG_SCHEMA;
  }

  async setupRpc(common: BaseReadOnlyConfig): Promise<void> {
    // v8 del SDK: el RPC es estado global. setupRpc puede llamarse varias veces
    // (idempotente para la misma URL/red).
    this.rpc = await setRpc(common.rpcUrl);
    this.deployment =
      common.network === "mainnet"
        ? WhirlpoolDeployment.mainnet
        : WhirlpoolDeployment.devnet;
  }

  attachWallet(wallet: KeyPairSigner): void {
    if (!this.rpc) {
      throw new Error("OrcaAdapter: attachWallet() called before setupRpc().");
    }
    this.wallet = wallet;
    setDefaultFunder(wallet);
  }

  // ---------------------------------------------------------------------------
  // Discovery (read-only) — implementaciones reales en F0.3
  // ---------------------------------------------------------------------------

  async listOwnedPositions(_owner: string): Promise<PositionRef[]> {
    this.getRpc(); // valida que setupRpc se ha llamado
    throw new Error("OrcaAdapter.listOwnedPositions: implementado en F0.3.");
  }

  async getPositionSummary(_ref: PositionRef): Promise<PositionSummary> {
    this.getRpc();
    throw new Error("OrcaAdapter.getPositionSummary: implementado en F0.3.");
  }

  // ---------------------------------------------------------------------------
  // CLI-style lifecycle
  // ---------------------------------------------------------------------------

  loadProtocolConfig(env: NodeJS.ProcessEnv): OrcaConfig {
    return loadOrcaConfig(env);
  }

  async init(
    common: BaseConfig,
    protocolConfig: unknown,
    wallet: KeyPairSigner,
  ): Promise<void> {
    await this.setupRpc(common);
    this.attachWallet(wallet);
    this.orcaConfig = protocolConfig as OrcaConfig;
  }

  async resolvePosition(): Promise<ResolvedPosition> {
    const rpc = this.getRpc();
    if (!this.orcaConfig) {
      throw new Error(
        "OrcaAdapter.resolvePosition: protocolConfig no cargado. Llama init() o pasa la config por otro camino.",
      );
    }
    const positionMint = address(this.orcaConfig.positionMint);
    const [positionAddress] = await getPositionAddress(positionMint);
    const position = await fetchPosition(rpc, positionAddress);
    const poolAddress = position.data.whirlpool;

    const raw: OrcaRawPosition = {
      positionMint,
      positionAddress,
      poolAddress,
      decimalsA: this.orcaConfig.decimalsA,
      decimalsB: this.orcaConfig.decimalsB,
    };

    return {
      id: this.orcaConfig.positionMint,
      poolLabel: String(poolAddress),
      raw,
    };
  }

  // ---------------------------------------------------------------------------
  // Watcher operations
  // ---------------------------------------------------------------------------

  async getPrice(position: ResolvedPosition): Promise<number> {
    const rpc = this.getRpc();
    const raw = position.raw as OrcaRawPosition;
    const pool = await fetchWhirlpool(rpc, raw.poolAddress);
    return sqrtPriceToPrice(
      pool.data.sqrtPrice,
      raw.decimalsA,
      raw.decimalsB,
    );
  }

  async closePosition(
    position: ResolvedPosition,
    slippageBps: number,
    dryRun: boolean,
  ): Promise<CloseResult> {
    const wallet = this.getWallet();
    const deployment = this.getDeployment();
    const raw = position.raw as OrcaRawPosition;

    const result = await closePosition(raw.positionMint, {
      slippageToleranceBps: slippageBps,
      whirlpoolDeployment: deployment,
    });

    const common = {
      estimatedTokenA: result.quote.tokenEstA?.toString(),
      estimatedTokenB: result.quote.tokenEstB?.toString(),
      feesTokenA: result.feesQuote.feeOwedA?.toString(),
      feesTokenB: result.feesQuote.feeOwedB?.toString(),
    };

    if (dryRun) {
      return {
        dryRun: true,
        ...common,
        notes: "DRY_RUN: no se envió la transacción (no se llamó al callback)",
      };
    }

    const txId = await result.callback(wallet);
    return {
      dryRun: false,
      txId,
      ...common,
    };
  }

  async swapToExit(
    position: ResolvedPosition,
    exitTokenMint: string,
    closeResult: CloseResult,
    slippageBps: number,
    dryRun: boolean,
  ): Promise<SwapExitResult> {
    const wallet = this.getWallet();
    const deployment = this.getDeployment();
    const rpc = this.getRpc();
    const raw = position.raw as OrcaRawPosition;
    const pool = await fetchWhirlpool(rpc, raw.poolAddress);
    const mintA = pool.data.tokenMintA;
    const mintB = pool.data.tokenMintB;

    const exitAddr = address(exitTokenMint);
    if (exitAddr !== mintA && exitAddr !== mintB) {
      throw new Error(
        `EXIT_TOKEN_MINT (${exitTokenMint}) no pertenece al pool de la posición ` +
          `(A=${mintA}, B=${mintB}). En v1 solo se soporta swap en la misma pool.`,
      );
    }

    const exitIsA = exitAddr === mintA;
    const fromMint = exitIsA ? mintB : mintA;
    const fromAmountStr = exitIsA
      ? closeResult.estimatedTokenB
      : closeResult.estimatedTokenA;
    const fromAmount = BigInt(fromAmountStr ?? "0");

    if (fromAmount === 0n) {
      return {
        dryRun,
        skipped: true,
        fromMint: String(fromMint),
        notes:
          "Nada que swapear: la posición ya entregó 0 del token de origen.",
      };
    }

    const swapResult = await swap(
      { inputAmount: fromAmount, mint: fromMint },
      raw.poolAddress,
      {
        slippageToleranceBps: slippageBps,
        signer: wallet,
        whirlpoolDeployment: deployment,
      },
    );

    const quote = swapResult.quote as {
      tokenIn: bigint;
      tokenEstOut: bigint;
      tokenMinOut: bigint;
    };

    const quoteFields = {
      fromMint: String(fromMint),
      inputAmount: quote.tokenIn.toString(),
      estimatedOutput: quote.tokenEstOut.toString(),
      minimumOutput: quote.tokenMinOut.toString(),
    };

    if (dryRun) {
      return {
        dryRun: true,
        skipped: false,
        ...quoteFields,
        notes: "DRY_RUN: swap no enviado",
      };
    }

    const txId = await swapResult.callback(wallet);
    return {
      dryRun: false,
      skipped: false,
      txId,
      ...quoteFields,
    };
  }

  // ---------------------------------------------------------------------------
  // Guards (getters que lanzan si no está inicializado)
  // ---------------------------------------------------------------------------

  private getRpc(): Rpc<SolanaRpcApi> {
    if (!this.rpc) {
      throw new Error(
        "OrcaAdapter: setupRpc() no se ha llamado. Llama setupRpc(common) primero.",
      );
    }
    return this.rpc;
  }

  private getDeployment(): typeof WhirlpoolDeployment.devnet {
    if (!this.deployment) {
      throw new Error(
        "OrcaAdapter: setupRpc() no se ha llamado. Llama setupRpc(common) primero.",
      );
    }
    return this.deployment;
  }

  private getWallet(): KeyPairSigner {
    if (!this.wallet) {
      throw new Error(
        "OrcaAdapter: wallet no asociada. Llama attachWallet(wallet) primero.",
      );
    }
    return this.wallet;
  }
}

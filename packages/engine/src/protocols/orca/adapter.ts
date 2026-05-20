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
  CloseResult,
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

export class OrcaAdapter implements ProtocolAdapter {
  readonly name = "orca";

  private rpc!: Rpc<SolanaRpcApi>;
  private wallet!: KeyPairSigner;
  private deployment!: typeof WhirlpoolDeployment.devnet;
  private orcaConfig!: OrcaConfig;

  loadProtocolConfig(env: NodeJS.ProcessEnv): OrcaConfig {
    return loadOrcaConfig(env);
  }

  async init(
    common: BaseConfig,
    protocolConfig: unknown,
    wallet: KeyPairSigner,
  ): Promise<void> {
    this.orcaConfig = protocolConfig as OrcaConfig;
    // v8 del SDK: el RPC y el funder son estado global; el payer se pasa al callback.
    this.rpc = await setRpc(common.rpcUrl);
    setDefaultFunder(wallet);
    this.wallet = wallet;
    this.deployment =
      common.network === "mainnet"
        ? WhirlpoolDeployment.mainnet
        : WhirlpoolDeployment.devnet;
  }

  async resolvePosition(): Promise<ResolvedPosition> {
    const positionMint = address(this.orcaConfig.positionMint);
    const [positionAddress] = await getPositionAddress(positionMint);
    const position = await fetchPosition(this.rpc, positionAddress);
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

  async getPrice(position: ResolvedPosition): Promise<number> {
    const raw = position.raw as OrcaRawPosition;
    const pool = await fetchWhirlpool(this.rpc, raw.poolAddress);
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
    const raw = position.raw as OrcaRawPosition;

    const result = await closePosition(raw.positionMint, {
      slippageToleranceBps: slippageBps,
      whirlpoolDeployment: this.deployment,
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

    const txId = await result.callback(this.wallet);
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
    const raw = position.raw as OrcaRawPosition;
    const pool = await fetchWhirlpool(this.rpc, raw.poolAddress);
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
        signer: this.wallet,
        whirlpoolDeployment: this.deployment,
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

    const txId = await swapResult.callback(this.wallet);
    return {
      dryRun: false,
      skipped: false,
      txId,
      ...quoteFields,
    };
  }
}

/**
 * Meteora DLMM adapter — read-only (F6.1).
 *
 * Coexiste con el adapter de Orca a pesar de usar SDKs incompatibles:
 * Orca → @solana/kit@5, Meteora → @solana/web3.js@1. La frontera del
 * ProtocolAdapter pasa primitivos (string, bigint), así que cada adapter
 * encapsula su SDK sin contagio. Ver discusión en F6.1 / ADR-024 (pendiente).
 *
 * Estado: listOwnedPositions + getPositionSummary + getPrice. closePosition
 * y swapToExit lanzan "not implemented" — F6.2/F6.3 los abrirán.
 */

import { createRequire } from "node:module";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  type Transaction,
} from "@solana/web3.js";
import type * as DLMMNs from "@meteora-ag/dlmm";
import type { KeyPairSigner } from "@solana/kit";
import BN from "bn.js";

/**
 * El bundle ESM (.mjs) de @meteora-ag/dlmm intenta `import { BN } from
 * "@coral-xyz/anchor"` y anchor 0.31.x no re-exporta BN como named ESM
 * export → SyntaxError al cargar bajo ESM puro. Usamos `createRequire`
 * para forzar el CJS bundle (dist/index.js) que sí funciona con anchor
 * vía CJS->ESM interop estándar de Node.
 *
 * Los tipos vienen del `import type` arriba (TypeScript ignora el
 * runtime resolver y resuelve a `dist/index.d.ts`).
 */
const requireCjs = createRequire(import.meta.url);
const meteoraSdk = requireCjs("@meteora-ag/dlmm") as typeof DLMMNs & {
  default: typeof DLMMNs.default;
};
const DLMM: typeof DLMMNs.default = meteoraSdk.default ?? (meteoraSdk as unknown as typeof DLMMNs.default);
const getPriceOfBinByBinId: typeof DLMMNs.getPriceOfBinByBinId = meteoraSdk.getPriceOfBinByBinId;

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
  TokenInfo,
} from "../types.js";
import { type MeteoraConfig, loadMeteoraConfig } from "./config.js";

/** Mainnet program id del DLMM (también la usa devnet). */
const LBCLMM_PROGRAM_ID = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";

export class MeteoraAdapter implements ProtocolAdapter {
  readonly name = "meteora";
  readonly displayName = "Meteora DLMM";

  private connection: Connection | undefined;
  private walletAddress: string | undefined;
  private meteoraConfig: MeteoraConfig | undefined;
  /**
   * Keypair de web3.js v1 derivado del raw secret. Solo se materializa
   * cuando F6.2.b lo pasa via attachWallet(signer, rawSecret). Sin él,
   * el adapter sigue funcionando read-only (lista, summary, getPrice y
   * closePosition en modo dryRun) pero closePosition real lanza.
   */
  private signingKeypair: Keypair | undefined;

  /**
   * Si `address` es un PDA de posición Meteora (owner program = LBCLMM),
   * lee el byte layout y devuelve la wallet propietaria. Si es cualquier
   * otra cosa (wallet normal, mint, sin existir), devuelve `address` tal
   * cual. Útil para probes y para detectar pegados de Solscan en la UI.
   *
   * Layout del position account: discriminator(8) + lbPair(32) + owner(32) + ...
   */
  static async resolveOwnerOf(
    rpcUrl: string,
    address: string,
  ): Promise<{ owner: string; via: "direct" | "position" }> {
    const conn = new Connection(rpcUrl, "confirmed");
    const info = await conn.getAccountInfo(new PublicKey(address));
    if (!info) return { owner: address, via: "direct" };
    if (info.owner.toBase58() === LBCLMM_PROGRAM_ID) {
      const ownerKey = new PublicKey(info.data.subarray(40, 72));
      return { owner: ownerKey.toBase58(), via: "position" };
    }
    return { owner: address, via: "direct" };
  }

  // ===========================================================================
  // Schema + setup
  // ===========================================================================

  getConfigSchema(): ConfigSchema {
    return {
      protocol: this.name,
      fields: [
        {
          key: "METEORA_LB_PAIR",
          label: "LbPair address",
          type: "address",
          required: true,
          description: "Public key of the DLMM pool (LbPair account).",
          group: "position",
        },
        {
          key: "METEORA_POSITION",
          label: "Position address",
          type: "address",
          required: true,
          description:
            "Public key of the position account (PDA derived from owner + lbPair).",
          group: "position",
        },
        {
          key: "METEORA_DECIMALS_X",
          label: "Token X decimals",
          type: "integer",
          required: false,
          defaultValue: 9,
          min: 0,
          max: 18,
          group: "position",
        },
        {
          key: "METEORA_DECIMALS_Y",
          label: "Token Y decimals",
          type: "integer",
          required: false,
          defaultValue: 6,
          min: 0,
          max: 18,
          group: "position",
        },
      ],
    };
  }

  async setupRpc(common: BaseReadOnlyConfig): Promise<void> {
    this.connection = new Connection(common.rpcUrl, "confirmed");
  }

  attachWallet(wallet: KeyPairSigner, rawSecret?: Uint8Array): void {
    this.walletAddress = wallet.address;
    if (rawSecret) {
      // F6.2.b: el SDK de Meteora firma con `Keypair` de web3.js v1.
      // Construirlo a partir de los 64 bytes del vault es la única vía
      // porque el CryptoKey de kit es non-extractable (ADR-024).
      this.signingKeypair = Keypair.fromSecretKey(rawSecret);
      // Verificación de paridad: si la address derivada de los bytes
      // no coincide con la del KeyPairSigner, algo está mal.
      const derived = this.signingKeypair.publicKey.toBase58();
      if (derived !== wallet.address) {
        this.signingKeypair = undefined;
        throw new Error(
          `MeteoraAdapter.attachWallet: rawSecret address (${derived}) != signer address (${wallet.address}).`,
        );
      }
    }
  }

  // ===========================================================================
  // Discovery
  // ===========================================================================

  async listOwnedPositions(owner: string): Promise<PositionRef[]> {
    const conn = this.getConnection();
    const ownerKey = new PublicKey(owner);
    // El SDK devuelve Map<lbPair, PositionInfo>; cada PositionInfo agrega
    // todas las posiciones del usuario en ese par (puede tener varias con
    // distintos rangos de bins).
    const map = await DLMM.getAllLbPairPositionsByUser(conn, ownerKey);

    const refs: PositionRef[] = [];
    for (const [lbPairStr, info] of map.entries()) {
      const xMint = info.lbPair.tokenXMint.toBase58();
      const yMint = info.lbPair.tokenYMint.toBase58();
      const binStep = info.lbPair.binStep;
      for (const pos of info.lbPairPositionsData) {
        refs.push({
          protocol: this.name,
          id: pos.publicKey.toBase58(),
          label: this.formatPoolLabel(xMint, yMint, binStep),
          poolId: lbPairStr,
        });
      }
    }
    return refs;
  }

  async getPositionSummary(ref: PositionRef): Promise<PositionSummary> {
    const conn = this.getConnection();
    const lbPairKey = new PublicKey(ref.poolId);
    const dlmm = await DLMM.create(conn, lbPairKey);

    // Self-sufficient: no exige attachWallet. Extraemos el owner del
    // byte layout de la posición y desde ahí entramos al path del SDK
    // que da el PositionInfo completo. Esto permite que la procedure
    // positions.getSummary del backend trabaje sin tener que firmar.
    const positionPk = new PublicKey(ref.id);
    const positionAccount = await conn.getAccountInfo(positionPk);
    if (!positionAccount) {
      throw new Error(
        `MeteoraAdapter.getPositionSummary: position ${ref.id} no existe on-chain.`,
      );
    }
    const owner = new PublicKey(positionAccount.data.subarray(40, 72));

    const all = await DLMM.getAllLbPairPositionsByUser(conn, owner);
    const info = all.get(ref.poolId);
    if (!info) {
      throw new Error(
        `MeteoraAdapter.getPositionSummary: el wallet ${owner.toBase58()} no tiene posiciones en ${ref.poolId}.`,
      );
    }
    const position = info.lbPairPositionsData.find(
      (p) => p.publicKey.toBase58() === ref.id,
    );
    if (!position) {
      throw new Error(
        `MeteoraAdapter.getPositionSummary: posición ${ref.id} no encontrada en ${ref.poolId}.`,
      );
    }

    const activeBin = await dlmm.getActiveBin();
    const currentPrice = Number.parseFloat(activeBin.pricePerToken);
    const binStep = info.lbPair.binStep;
    const lowerPrice = Number.parseFloat(
      dlmm.fromPricePerLamport(
        getPriceOfBinByBinId(position.positionData.lowerBinId, binStep).toNumber(),
      ),
    );
    const upperPrice = Number.parseFloat(
      dlmm.fromPricePerLamport(
        getPriceOfBinByBinId(position.positionData.upperBinId, binStep).toNumber(),
      ),
    );

    const tokenA: TokenInfo = {
      mint: info.lbPair.tokenXMint.toBase58(),
      decimals: info.tokenX.mint.decimals,
    };
    const tokenB: TokenInfo = {
      mint: info.lbPair.tokenYMint.toBase58(),
      decimals: info.tokenY.mint.decimals,
    };

    return {
      ref,
      tokenA,
      tokenB,
      currentPrice,
      range: { min: lowerPrice, max: upperPrice },
      isInRange:
        currentPrice >= lowerPrice && currentPrice <= upperPrice,
      liquidity: {
        tokenA: position.positionData.totalXAmount,
        tokenB: position.positionData.totalYAmount,
      },
      feesPending: {
        tokenA: position.positionData.feeX.toString(),
        tokenB: position.positionData.feeY.toString(),
      },
    };
  }

  // ===========================================================================
  // CLI-style lifecycle
  // ===========================================================================

  loadProtocolConfig(env: NodeJS.ProcessEnv): unknown {
    return loadMeteoraConfig(env);
  }

  async init(
    common: BaseConfig,
    protocolConfig: unknown,
    wallet: KeyPairSigner,
    rawSecret?: Uint8Array,
  ): Promise<void> {
    await this.setupRpc(common);
    this.attachWallet(wallet, rawSecret);
    this.meteoraConfig = protocolConfig as MeteoraConfig;
  }

  async resolvePosition(): Promise<ResolvedPosition> {
    if (!this.meteoraConfig) {
      throw new Error(
        "MeteoraAdapter.resolvePosition: protocolConfig no cargado. Llama init().",
      );
    }
    return {
      id: this.meteoraConfig.position,
      poolLabel: `meteora · ${this.meteoraConfig.lbPair.slice(0, 6)}…`,
      raw: this.meteoraConfig,
    };
  }

  // ===========================================================================
  // Watcher operations
  // ===========================================================================

  async getPrice(position: ResolvedPosition): Promise<number> {
    const conn = this.getConnection();
    const cfg = position.raw as MeteoraConfig;
    const dlmm = await DLMM.create(conn, new PublicKey(cfg.lbPair));
    const activeBin = await dlmm.getActiveBin();
    return Number.parseFloat(activeBin.pricePerToken);
  }

  async closePosition(
    position: ResolvedPosition,
    _slippageBps: number,
    dryRun: boolean,
  ): Promise<CloseResult> {
    // Leemos el estado actual on-chain — tanto para el quote del dry-run
    // como para que el real path tenga lower/upper bin frescos.
    const conn = this.getConnection();
    const cfg = position.raw as MeteoraConfig;

    const positionPk = new PublicKey(cfg.position);
    const positionAccount = await conn.getAccountInfo(positionPk);
    if (!positionAccount) {
      throw new Error(
        `MeteoraAdapter.closePosition: position ${cfg.position} no existe on-chain (posiblemente ya cerrada).`,
      );
    }
    const owner = new PublicKey(positionAccount.data.subarray(40, 72));

    const all = await DLMM.getAllLbPairPositionsByUser(conn, owner);
    const info = all.get(cfg.lbPair);
    if (!info) {
      throw new Error(
        `MeteoraAdapter.closePosition: el wallet ${owner.toBase58()} no tiene posiciones en ${cfg.lbPair}.`,
      );
    }
    const pos = info.lbPairPositionsData.find(
      (p) => p.publicKey.toBase58() === cfg.position,
    );
    if (!pos) {
      throw new Error(
        `MeteoraAdapter.closePosition: posición ${cfg.position} no encontrada en el pool.`,
      );
    }

    // Cantidades quote — mismas en dry-run y real (estimación pre-firma).
    const estimatedTokenA = pos.positionData.totalXAmount;
    const estimatedTokenB = pos.positionData.totalYAmount;
    const feesTokenA = pos.positionData.feeX.toString();
    const feesTokenB = pos.positionData.feeY.toString();

    if (dryRun) {
      return {
        dryRun: true,
        estimatedTokenA,
        estimatedTokenB,
        feesTokenA,
        feesTokenB,
        notes: "DRY_RUN: posición lista para cerrar. No se envió tx.",
      };
    }

    // === Real path (F6.2.b) ===

    if (!this.signingKeypair) {
      throw new Error(
        "MeteoraAdapter.closePosition: no hay signing keypair. attachWallet() debe llamarse con rawSecret para Meteora real.",
      );
    }
    if (owner.toBase58() !== this.signingKeypair.publicKey.toBase58()) {
      throw new Error(
        `MeteoraAdapter.closePosition: position owner (${owner.toBase58()}) != signing wallet (${this.signingKeypair.publicKey.toBase58()}).`,
      );
    }

    const dlmm = await DLMM.create(conn, new PublicKey(cfg.lbPair));
    const { lowerBinId, upperBinId } = pos.positionData;

    // Una sola llamada construye la cadena completa: remove 100% (bps=10000)
    // + claim fees + close PDA, gracias a shouldClaimAndClose: true. El SDK
    // puede devolver más de una Transaction si los bins ocupados no caben
    // en una sola tx por límite de compute units.
    const txs: Transaction[] = await dlmm.removeLiquidity({
      user: this.signingKeypair.publicKey,
      position: positionPk,
      fromBinId: lowerBinId,
      toBinId: upperBinId,
      bps: new BN(10_000),
      shouldClaimAndClose: true,
    });

    if (txs.length === 0) {
      // Caso degenerado: SDK no produjo ninguna tx. Probablemente la
      // posición ya estaba vacía y cerrada. Devolvemos quote sin txId.
      return {
        dryRun: false,
        estimatedTokenA,
        estimatedTokenB,
        feesTokenA,
        feesTokenB,
        notes:
          "removeLiquidity devolvió 0 transactions — la posición probablemente ya estaba cerrada.",
      };
    }

    let lastSig = "";
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i]!;
      const recent = await conn.getLatestBlockhash("confirmed");
      tx.recentBlockhash = recent.blockhash;
      tx.lastValidBlockHeight = recent.lastValidBlockHeight;
      tx.feePayer = this.signingKeypair.publicKey;
      lastSig = await sendAndConfirmTransaction(
        conn,
        tx,
        [this.signingKeypair],
        { commitment: "confirmed" },
      );
    }

    return {
      dryRun: false,
      txId: lastSig,
      estimatedTokenA,
      estimatedTokenB,
      feesTokenA,
      feesTokenB,
      notes:
        txs.length > 1
          ? `Posición cerrada en ${txs.length} transactions. La última es ${lastSig}.`
          : undefined,
    };
  }

  async swapToExit(): Promise<SwapExitResult> {
    throw new Error(
      "MeteoraAdapter.swapToExit: no implementado en F6.1. Pendiente F6.3.",
    );
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private getConnection(): Connection {
    if (!this.connection) {
      throw new Error(
        "MeteoraAdapter: RPC no configurado. Llama setupRpc() antes.",
      );
    }
    return this.connection;
  }

  /**
   * Label "Xmint…/Ymint… 0.20%" cuando no tenemos symbol resolver.
   * La UI suele sustituir mints conocidos por símbolos a posteriori
   * vía su token registry, así que aquí el label no es crítico.
   */
  private formatPoolLabel(
    xMint: string,
    yMint: string,
    binStepBps: number,
  ): string {
    const trunc = (s: string): string => `${s.slice(0, 4)}…${s.slice(-4)}`;
    const feePct = (binStepBps / 100).toFixed(2);
    return `${trunc(xMint)}/${trunc(yMint)} ${feePct}%`;
  }
}


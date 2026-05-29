import type { KeyPairSigner } from "@solana/kit";
import type { BaseConfig, ProtocolAdapter } from "../protocols/types.js";
import { log } from "./logger.js";
import { loop } from "./loop.js";
import { withRetry, isPermanentSolanaError } from "./retry.js";

export interface RunnerOptions {
  adapter: ProtocolAdapter;
  base: BaseConfig;
  protocolConfig: unknown;
  wallet: KeyPairSigner;
  /** Los 64 bytes del secret. Necesario para adapters que firman con
   * `Keypair` de web3.js v1 (Meteora). Adapters que no lo usen lo ignoran. */
  rawSecret?: Uint8Array;
}

export async function runRunner(opts: RunnerOptions): Promise<void> {
  const { adapter, base, protocolConfig, wallet, rawSecret } = opts;

  await adapter.init(base, protocolConfig, wallet, rawSecret);
  const position = await adapter.resolvePosition();

  const cmp = base.direction === "above" ? ">=" : "<=";
  log(`Posición resuelta: id=${position.id} pool=${position.poolLabel}`);
  log(`Objetivo: precio ${cmp} ${base.targetPrice}`);
  log(`Polling cada ${base.pollMs}ms | dryRun=${base.dryRun}`);

  await loop({
    pollMs: base.pollMs,
    tick: async () => {
      const price = await adapter.getPrice(position);
      log(`[${adapter.name}] price=${price} target=${cmp}${base.targetPrice}`);

      const triggered =
        base.direction === "above"
          ? price >= base.targetPrice
          : price <= base.targetPrice;

      if (!triggered) return "continue";

      log("Trigger alcanzado. Cerrando posición...");
      const result = await withRetry(
        () => adapter.closePosition(position, base.slippageBps, base.dryRun),
        {
          maxAttempts: 5,
          baseMs: 1000,
          label: `${adapter.name}.closePosition`,
          retryableErrors: (err) => !isPermanentSolanaError(err),
        },
      );

      log(
        `Cierre ${result.dryRun ? "SIMULADO (dry-run)" : "ejecutado"} | txId=${result.txId ?? "(n/a)"}`,
      );
      log(
        `  estTokenA=${result.estimatedTokenA ?? "?"} estTokenB=${result.estimatedTokenB ?? "?"}`,
      );
      log(
        `  feesA=${result.feesTokenA ?? "?"} feesB=${result.feesTokenB ?? "?"}`,
      );
      if (result.notes) log(`  notes: ${result.notes}`);

      const { exitTokenMint } = base;
      if (exitTokenMint) {
        log(
          `Swap a token de salida: ${exitTokenMint} | slippage=${base.exitSwapSlippageBps}bps`,
        );
        const swapResult = await withRetry(
          () =>
            adapter.swapToExit(
              position,
              exitTokenMint,
              result,
              base.exitSwapSlippageBps,
              base.dryRun,
            ),
          {
            maxAttempts: 5,
            baseMs: 1000,
            label: `${adapter.name}.swapToExit`,
            retryableErrors: (err) => !isPermanentSolanaError(err),
          },
        );

        if (swapResult.skipped) {
          log(`Swap omitido: ${swapResult.notes ?? ""}`);
        } else {
          log(
            `Swap ${swapResult.dryRun ? "SIMULADO (dry-run)" : "ejecutado"} | txId=${swapResult.txId ?? "(n/a)"}`,
          );
          log(
            `  fromMint=${swapResult.fromMint} in=${swapResult.inputAmount} estOut=${swapResult.estimatedOutput} minOut=${swapResult.minimumOutput}`,
          );
          if (swapResult.notes) log(`  notes: ${swapResult.notes}`);
        }
      }

      return "stop";
    },
  });

  log("Runner finalizado.");
}

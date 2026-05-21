#!/usr/bin/env tsx
/**
 * Probe del adapter Meteora DLMM en modo read-only.
 *
 * Uso:
 *   pnpm tsx scripts/probe-meteora.ts <ownerAddress> [--mainnet]
 *
 * - Lista posiciones DLMM del owner via el SDK.
 * - Para cada posición, imprime el summary (precio actual, range, liquidity,
 *   fees pending).
 * - No firma nada. No requiere wallet local descifrada.
 */

import type { KeyPairSigner } from "@solana/kit";
import { MeteoraAdapter } from "../packages/engine/src/protocols/meteora/adapter.js";
import { tokenSymbolGuess } from "./_token-guess.js";

async function main(): Promise<void> {
  const given = process.argv[2];
  if (!given) {
    console.error(
      "uso: pnpm tsx scripts/probe-meteora.ts <ownerAddress|positionAddress> [--mainnet]",
    );
    process.exit(1);
  }
  const isMainnet = process.argv.includes("--mainnet");
  const rpcUrl = isMainnet
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";

  console.log(`[probe] input=${given}`);
  console.log(`[probe] rpc=${rpcUrl} (${isMainnet ? "mainnet" : "devnet"})`);

  const { owner, via } = await MeteoraAdapter.resolveOwnerOf(rpcUrl, given);
  if (via === "position") {
    console.log(
      `[probe] input es un PDA de posición Meteora → extraída owner=${owner}`,
    );
  }

  const adapter = new MeteoraAdapter();
  await adapter.setupRpc({
    network: isMainnet ? "mainnet" : "devnet",
    rpcUrl,
  });
  // attachWallet expects a KeyPairSigner pero el adapter en modo read-only
  // solo lee `.address`. Sintetizamos un signer fake con solo la address.
  adapter.attachWallet({
    address: owner,
  } as unknown as KeyPairSigner);

  const t0 = Date.now();
  const refs = await adapter.listOwnedPositions(owner);
  console.log(
    `[probe] listOwnedPositions → ${refs.length} posición(es) en ${
      Date.now() - t0
    }ms`,
  );

  if (refs.length === 0) {
    console.log("[probe] sin posiciones — nada más que mostrar.");
    return;
  }

  for (const ref of refs) {
    console.log("");
    console.log(`──── ${ref.label}`);
    console.log(`  id:   ${ref.id}`);
    console.log(`  pool: ${ref.poolId}`);
    try {
      const sum = await adapter.getPositionSummary(ref);
      const symA = tokenSymbolGuess(sum.tokenA.mint);
      const symB = tokenSymbolGuess(sum.tokenB.mint);
      console.log(`  tokens: ${symA} / ${symB}`);
      console.log(
        `  current price: ${sum.currentPrice} ${symB} per ${symA}`,
      );
      console.log(
        `  range: ${sum.range.min} – ${sum.range.max} (${
          sum.isInRange ? "IN range" : "OUT of range"
        })`,
      );
      const liqA = scaleAmount(sum.liquidity.tokenA, sum.tokenA.decimals);
      const liqB = scaleAmount(sum.liquidity.tokenB, sum.tokenB.decimals);
      console.log(`  liquidity: ${liqA} ${symA} · ${liqB} ${symB}`);
      if (sum.feesPending) {
        const feeA = scaleAmount(sum.feesPending.tokenA, sum.tokenA.decimals);
        const feeB = scaleAmount(sum.feesPending.tokenB, sum.tokenB.decimals);
        console.log(`  fees:      ${feeA} ${symA} · ${feeB} ${symB}`);
      }
      try {
        const price = await adapter.getPrice({
          id: ref.id,
          poolLabel: ref.label,
          raw: { lbPair: ref.poolId } as { lbPair: string },
        });
        console.log(`  getPrice() check: ${price}`);
      } catch (err) {
        console.log(`  getPrice() failed: ${(err as Error).message}`);
      }

      // F6.2.a: si se pasa --close-dry-run, ejercemos closePosition en modo
      // simulación para validar el quote.
      if (process.argv.includes("--close-dry-run")) {
        try {
          const close = await adapter.closePosition(
            {
              id: ref.id,
              poolLabel: ref.label,
              raw: {
                lbPair: ref.poolId,
                position: ref.id,
                decimalsX: sum.tokenA.decimals,
                decimalsY: sum.tokenB.decimals,
              },
            },
            100,
            true,
          );
          const eA = scaleAmount(close.estimatedTokenA ?? "0", sum.tokenA.decimals);
          const eB = scaleAmount(close.estimatedTokenB ?? "0", sum.tokenB.decimals);
          const fA = scaleAmount(close.feesTokenA ?? "0", sum.tokenA.decimals);
          const fB = scaleAmount(close.feesTokenB ?? "0", sum.tokenB.decimals);
          console.log(
            `  closePosition(dryRun): receive ${eA} ${symA} + ${eB} ${symB}, fees ${fA} ${symA} + ${fB} ${symB}`,
          );
        } catch (err) {
          console.log(`  closePosition(dryRun) failed: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      console.log(`  summary failed: ${(err as Error).message}`);
    }
  }
}

function scaleAmount(raw: string, decimals: number): string {
  // Acepta tanto "1.234" (totalXAmount es string decimal del SDK) como
  // "1234" (raw lamports). Heurística: si contiene '.', está ya escalado.
  if (raw.includes(".")) return raw;
  try {
    const big = BigInt(raw);
    const div = 10n ** BigInt(decimals);
    const whole = big / div;
    const frac = big % div;
    if (frac === 0n) return whole.toString();
    const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${whole}.${fracStr}`;
  } catch {
    return raw;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

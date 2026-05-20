/**
 * Smoke test for F0.3: listOwnedPositions + getPositionSummary.
 * Uso: tsx scripts/probe-discovery.ts <walletAddress>
 */
import { OrcaAdapter } from "../packages/engine/src/protocols/orca/adapter.js";

const owner = process.argv[2];
if (!owner) {
  console.error("Uso: tsx scripts/probe-discovery.ts <walletAddress>");
  process.exit(1);
}

const adapter = new OrcaAdapter();
await adapter.setupRpc({
  network: "devnet",
  rpcUrl: "https://api.devnet.solana.com",
});

console.log(`Buscando posiciones Orca de ${owner}...`);
const refs = await adapter.listOwnedPositions(owner);
console.log(`Encontradas: ${refs.length}\n`);

for (const ref of refs) {
  console.log(`PositionRef:`);
  console.log(`  id      ${ref.id}`);
  console.log(`  label   ${ref.label}`);
  console.log(`  poolId  ${ref.poolId}`);

  const summary = await adapter.getPositionSummary(ref);
  console.log(`Summary:`);
  console.log(`  tokenA       ${summary.tokenA.mint} (decimals=${summary.tokenA.decimals})`);
  console.log(`  tokenB       ${summary.tokenB.mint} (decimals=${summary.tokenB.decimals})`);
  console.log(`  currentPrice ${summary.currentPrice}`);
  console.log(`  range        ${summary.range.min} → ${summary.range.max}`);
  console.log(`  isInRange    ${summary.isInRange}`);
  console.log(`  liquidity    A=${summary.liquidity.tokenA} B=${summary.liquidity.tokenB}`);
  console.log(
    `  feesPending  A=${summary.feesPending?.tokenA ?? "?"} B=${summary.feesPending?.tokenB ?? "?"}`,
  );
  console.log("");
}

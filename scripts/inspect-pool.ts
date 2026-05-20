import { fetchWhirlpool } from "@orca-so/whirlpools-client";
import { createSolanaRpc, address } from "@solana/kit";

const poolAddr = process.argv[2];
const rpcUrl = process.argv[3] ?? "https://api.devnet.solana.com";
if (!poolAddr) {
  console.error("Uso: tsx scripts/inspect-pool.ts <poolAddress> [rpcUrl]");
  process.exit(1);
}

const rpc = createSolanaRpc(rpcUrl);
const pool = await fetchWhirlpool(rpc, address(poolAddr));
console.log(`Pool:        ${poolAddr}`);
console.log(`Token A:     ${pool.data.tokenMintA}`);
console.log(`Token B:     ${pool.data.tokenMintB}`);
console.log(`Tick spacing: ${pool.data.tickSpacing}`);
console.log(`Fee rate:    ${pool.data.feeRate / 10000}%`);
console.log(`sqrtPrice:   ${pool.data.sqrtPrice}`);

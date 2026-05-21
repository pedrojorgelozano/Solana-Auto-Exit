/**
 * Mini token registry para usar en probes. La UI tiene el suyo (
 * `packages/web/src/lib/tokens.ts`); aquí solo necesitamos los mints más
 * comunes de mainnet + devnet para que los logs sean legibles.
 */
const KNOWN: Record<string, string> = {
  So11111111111111111111111111111111111111112: "SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k: "devUSDC",
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: "mSOL",
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: "JitoSOL",
};

export function tokenSymbolGuess(mint: string): string {
  return KNOWN[mint] ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

/**
 * Mini token registry. No queremos depender de Jupiter token list ni Metaplex
 * para una UI local — para los pares que de verdad usa el bot (devnet en F1)
 * basta con hardcodear los conocidos. Cualquier mint que no esté aquí cae
 * al fallback de "address truncado".
 */

export interface TokenMeta {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
}

const KNOWN: TokenMeta[] = [
  // SOL nativo (wrapped mint)
  {
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
  },
  // USDC mainnet
  {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  // USDT mainnet
  {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  // devUSDC del pool Orca devnet (el que estamos usando para validaciones)
  {
    mint: "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k",
    symbol: "devUSDC",
    name: "Devnet USDC (Orca)",
    decimals: 6,
  },
];

const BY_MINT = new Map(KNOWN.map((t) => [t.mint, t]));

/** Devuelve el símbolo conocido o el address truncado si no lo conocemos. */
export function tokenSymbol(mint: string): string {
  const known = BY_MINT.get(mint);
  if (known) return known.symbol;
  if (!mint) return "?";
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

/** Metadata completa si la conocemos, undefined si no. */
export function tokenMeta(mint: string): TokenMeta | undefined {
  return BY_MINT.get(mint);
}

/** ¿Conocemos este mint? */
export function isKnownToken(mint: string): boolean {
  return BY_MINT.has(mint);
}

/** Lista solo lectura para selectores. */
export function allKnownTokens(): readonly TokenMeta[] {
  return KNOWN;
}

/**
 * Mini token registry. No queremos depender de Jupiter token list ni Metaplex
 * para una UI local — para los pares que de verdad usa el bot basta con
 * hardcodear los conocidos. Cualquier mint que no esté aquí cae al fallback
 * (truncate del address en `tokenSymbol`, color generado del hash en
 * `TokenBadge`).
 */

export interface TokenMeta {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  /**
   * Background CSS del placeholder visual (mientras no bundleemos SVGs
   * reales — apuntado al backlog). Puede ser un color sólido (#RRGGBB) o
   * un linear-gradient. Si no se especifica, se genera del hash del mint.
   */
  color?: string;
}

const KNOWN: TokenMeta[] = [
  // SOL nativo (wrapped mint) — gradient oficial Solana brand
  {
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    color: "linear-gradient(135deg, #9945FF 0%, #14F195 100%)",
  },
  // USDC mainnet
  {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    color: "#2775CA",
  },
  // USDT mainnet
  {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    color: "#26A17B",
  },
  // USDe — Ethena synthetic dollar. OJO: 9 decimals (no 6 como otras stables).
  {
    mint: "DEkqHyPN7GMRJ5cArtQFAWefqbZb33Hyf6s5iCwjEonT",
    symbol: "USDe",
    name: "Ethena USDe",
    decimals: 9,
    color: "#1A1A1A",
  },
  // USDS — Sky Dollar (antes DAI/Maker → Sky)
  {
    mint: "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA",
    symbol: "USDS",
    name: "Sky Dollar",
    decimals: 6,
    color: "#1AAB9B",
  },
  // EURC — Circle euro stablecoin
  {
    mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
    symbol: "EURC",
    name: "Euro Coin",
    decimals: 6,
    color: "#1A4FCA",
  },
  // USDY — Ondo US Dollar Yield (tokenized T-bills)
  {
    mint: "A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6",
    symbol: "USDY",
    name: "Ondo US Dollar Yield",
    decimals: 6,
    color: "#5A4FE0",
  },
  // devUSDC del pool Orca devnet
  {
    mint: "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k",
    symbol: "devUSDC",
    name: "Devnet USDC (Orca)",
    decimals: 6,
    color: "#2775CA",
  },
  // JitoSOL — liquid staking token (Jito)
  {
    mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    symbol: "JitoSOL",
    name: "Jito Staked SOL",
    decimals: 9,
    color: "#00D18C",
  },
  // mSOL — Marinade staked SOL
  {
    mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    symbol: "mSOL",
    name: "Marinade Staked SOL",
    decimals: 9,
    color: "#3E64B7",
  },
  // bSOL — Blaze stake
  {
    mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
    symbol: "bSOL",
    name: "BlazeStake Staked SOL",
    decimals: 9,
    color: "#FF8A3C",
  },
  // BONK
  {
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    color: "#F1B100",
  },
  // JUP — Jupiter
  {
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
    color: "#1F2024",
  },
  // ORCA
  {
    mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    symbol: "ORCA",
    name: "Orca",
    decimals: 6,
    color: "#FFD15C",
  },
  // RAY — Raydium
  {
    mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    symbol: "RAY",
    name: "Raydium",
    decimals: 6,
    color: "#3B3FCC",
  },
  // WIF — dogwifhat
  {
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    symbol: "WIF",
    name: "dogwifhat",
    decimals: 6,
    color: "#E87D6E",
  },
  // PYUSD — PayPal USD (Token-2022). Mint oficial publicado por PayPal.
  {
    mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    symbol: "PYUSD",
    name: "PayPal USD",
    decimals: 6,
    color: "#0070BA",
  },
  // JLP — Jupiter Perps LP token
  {
    mint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4",
    symbol: "JLP",
    name: "Jupiter Perps LP",
    decimals: 6,
    color: "#22CCEE",
  },
  // jupSOL — Jupiter liquid staking token
  {
    mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",
    symbol: "jupSOL",
    name: "Jupiter Staked SOL",
    decimals: 9,
    color: "#C7F284",
  },
  // INF — Sanctum Infinity (LST pool token)
  {
    mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
    symbol: "INF",
    name: "Sanctum Infinity",
    decimals: 9,
    color: "#7C5CFF",
  },
  // JTO — Jito governance token
  {
    mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    symbol: "JTO",
    name: "Jito",
    decimals: 9,
    color: "#2FD9B5",
  },
  // PYTH — Pyth Network
  {
    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    symbol: "PYTH",
    name: "Pyth Network",
    decimals: 6,
    color: "#7142CF",
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

/**
 * Color de fondo para mints no conocidos. Determinista en el mint — siempre
 * el mismo color para el mismo token, aunque no esté en el registry. HSL
 * con saturación y lightness fijas para garantizar contraste con texto
 * blanco sobre cualquier hue.
 */
export function fallbackTokenColor(mint: string): string {
  let hash = 0;
  for (let i = 0; i < mint.length; i++) {
    hash = (hash * 31 + mint.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 42%)`;
}

/** Color del badge: el del registry si se conoce, fallback hash-based si no. */
export function tokenColor(mint: string): string {
  return BY_MINT.get(mint)?.color ?? fallbackTokenColor(mint);
}

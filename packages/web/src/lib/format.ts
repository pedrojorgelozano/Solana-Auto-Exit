import { tokenSymbol } from "./tokens";

/**
 * Convierte un raw amount (bigint serializado como string) a decimal legible
 * con los decimals del token.
 */
export function formatTokenAmount(
  raw: string | undefined | null,
  decimals: number,
  maxFrac = 6,
): string {
  if (raw === undefined || raw === null) return "0";
  let big: bigint;
  try {
    big = BigInt(raw);
  } catch {
    return String(raw);
  }
  if (big === 0n) return "0";
  const negative = big < 0n;
  const abs = negative ? -big : big;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const fractional = abs % divisor;
  let fracStr = fractional.toString().padStart(decimals, "0").slice(0, maxFrac);
  fracStr = fracStr.replace(/0+$/, "");
  const result = fracStr ? `${whole}.${fracStr}` : whole.toString();
  return negative ? `-${result}` : result;
}

/**
 * "0.1 SOL" / "1.116 USDC" / "0.05 So11…1112" si el mint no se conoce.
 */
export function formatAmountWithSymbol(
  raw: string | undefined | null,
  mint: string,
  decimals: number,
  maxFrac = 6,
): string {
  const value = formatTokenAmount(raw, decimals, maxFrac);
  return `${value} ${tokenSymbol(mint)}`;
}

/** Trunca un Solana address (32-44 chars base58) a "abcd…efgh". */
export function truncateAddress(addr: string, head = 4, tail = 4): string {
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Formatea un número decimal con un número fijo de decimales (sin trailing zeros). */
export function formatPrice(n: number, decimals = 4): string {
  if (!Number.isFinite(n)) return "?";
  const s = n.toFixed(decimals);
  return s.replace(/\.?0+$/, "") || "0";
}

/**
 * "1 SOL = 22.37 devUSDC" — frase completa que da contexto al precio.
 */
export function formatPrice1To1(
  price: number,
  tokenAMint: string,
  tokenBMint: string,
  decimals = 6,
): string {
  return `1 ${tokenSymbol(tokenAMint)} = ${formatPrice(price, decimals)} ${tokenSymbol(tokenBMint)}`;
}

/**
 * Distancia relativa entre precio actual y target.
 * Devuelve { text: "+10.5%", reached: false }.
 */
export function formatDistance(
  current: number | null | undefined,
  target: number,
  direction: "above" | "below",
): { text: string; reached: boolean; pct: number | null } {
  if (current === null || current === undefined || !Number.isFinite(current)) {
    return { text: "—", reached: false, pct: null };
  }
  const pct = ((target - current) / current) * 100;
  const sign = pct >= 0 ? "+" : "";
  const reached = direction === "above" ? current >= target : current <= target;
  return {
    text: `${sign}${pct.toFixed(2)}%`,
    reached,
    pct,
  };
}

/**
 * "30s" / "1 min" / "5 min" — convierte un poll interval en algo legible.
 */
export function formatPollInterval(ms: number): string {
  if (ms < 60_000) {
    return `${Math.round(ms / 1000)}s`;
  }
  const minutes = ms / 60_000;
  if (Number.isInteger(minutes)) {
    return `${minutes} min`;
  }
  return `${minutes.toFixed(1)} min`;
}

/**
 * "1% (100 bps)" — convierte slippage en bps a porcentaje legible.
 */
export function formatSlippage(bps: number): string {
  const pct = bps / 100;
  const pctStr = Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
  return `${pctStr} (${bps} bps)`;
}

/**
 * "Sell when 1 SOL ≥ 25 USDC" — una frase legible del trigger.
 */
export function formatTriggerSentence(
  direction: "above" | "below",
  target: number,
  tokenAMint: string | undefined,
  tokenBMint: string | undefined,
): string {
  const a = tokenAMint ? tokenSymbol(tokenAMint) : "Token A";
  const b = tokenBMint ? tokenSymbol(tokenBMint) : "Token B";
  const op = direction === "above" ? "≥" : "≤";
  return `Close when 1 ${a} ${op} ${formatPrice(target, 6)} ${b}`;
}

/**
 * "in range" / "out of range" → "In your range" / "Out of range" (legible).
 */
export function formatRangeStatus(isInRange: boolean): string {
  return isInRange ? "In your range" : "Out of range";
}

/**
 * "5m ago" / "just now" / "2h ago". timestamp en ms.
 */
export function formatTimeAgo(timestampMs: number | null): string {
  if (timestampMs === null) return "—";
  const diff = Date.now() - timestampMs;
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return new Date(timestampMs).toLocaleDateString();
}

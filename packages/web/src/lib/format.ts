/**
 * Convierte un raw amount (bigint serializado como string) a decimal legible
 * con los decimals del token.
 */
export function formatTokenAmount(
  raw: string | undefined,
  decimals: number,
  maxFrac = 6,
): string {
  if (!raw) return "0";
  let big: bigint;
  try {
    big = BigInt(raw);
  } catch {
    return raw;
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

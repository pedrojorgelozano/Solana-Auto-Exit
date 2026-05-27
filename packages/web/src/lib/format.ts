import { tokenSymbol } from "./tokens";
import { en } from "@/i18n/en";

/**
 * Tipo del dictionary completo. Los helpers que devuelven strings
 * localizables aceptan un `t` opcional; si no se pasa, caen al inglés
 * (en.ts) — útil para llamadas desde lógica de fondo, defaults en
 * placeholders, etc. La UI siempre debe pasar el `t` del hook useT().
 */
type Dict = typeof en;

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
  // Coma de miles en la parte entera (formato inglés). BigInt.toLocaleString
  // funciona desde Node 18+; aquí seguro porque la app es Node 20+.
  const wholeStr = whole.toLocaleString("en-US");
  const result = fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
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

/**
 * Formatea un número decimal en formato inglés (coma de miles, punto decimal).
 * Default 2 decimales — el formato estándar de precios financieros, legible
 * para todos los perfiles. Si el número es muy pequeño (típico de memes
 * como BONK, ~0.00001), bumpea automáticamente para no perder precisión.
 *   22.3773    → "22.38"
 *   1234.5     → "1,234.50" (con minimum 2 si abs>=1 — sin trailing fold)
 *   1000000.5  → "1,000,000.50"
 *   0.0001234  → "0.000123"  (auto-bump a 6 decimales)
 *   0.00000123 → "0.00000123" (auto-bump a 8 decimales)
 *
 * El caller puede forzar más precisión pasando `decimals` explícito.
 */
export function formatPrice(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "?";
  const abs = Math.abs(n);
  let max = decimals;
  let min = abs >= 1 ? decimals : 0;
  if (abs > 0 && abs < 0.0001) {
    max = Math.max(decimals, 8);
    min = 0;
  } else if (abs > 0 && abs < 0.01) {
    max = Math.max(decimals, 6);
    min = 0;
  } else if (abs > 0 && abs < 1) {
    max = Math.max(decimals, 4);
    min = 0;
  }
  return n.toLocaleString("en-US", {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
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
export function formatRangeStatus(isInRange: boolean, t: Dict = en): string {
  return isInRange ? t.format.inRange : t.format.outOfRange;
}

/**
 * Resumen compacto de los dos triggers de un auto-exit.
 * "TP ≥ 25 · SL ≤ 18" / "TP ≥ 25" / "SL ≤ 18" / "—".
 */
export function formatTriggers(
  takeProfit: number | null,
  stopLoss: number | null,
  decimals = 2,
): string {
  const parts: string[] = [];
  if (takeProfit !== null) {
    parts.push(`TP ≥ ${formatPrice(takeProfit, decimals)}`);
  }
  if (stopLoss !== null) {
    parts.push(`SL ≤ ${formatPrice(stopLoss, decimals)}`);
  }
  return parts.join(" · ") || "—";
}

/**
 * Distancia al trigger más cercano (el primero que se activaría con el precio
 * actual moviéndose hacia él). Devuelve null si no hay triggers.
 */
export function formatNearestDistance(
  current: number | null | undefined,
  takeProfit: number | null,
  stopLoss: number | null,
): { text: string; reached: boolean; pct: number | null; kind: "tp" | "sl" | null } {
  if (current === null || current === undefined) {
    return { text: "—", reached: false, pct: null, kind: null };
  }
  const tp =
    takeProfit !== null ? formatDistance(current, takeProfit, "above") : null;
  const sl =
    stopLoss !== null ? formatDistance(current, stopLoss, "below") : null;

  // Si alguno ya está triggered, priorizar ese.
  if (tp?.reached) return { ...tp, kind: "tp" };
  if (sl?.reached) return { ...sl, kind: "sl" };

  // En otro caso, elegir el de menor distancia absoluta.
  if (tp && sl) {
    const tpAbs = Math.abs(tp.pct ?? Infinity);
    const slAbs = Math.abs(sl.pct ?? Infinity);
    return tpAbs <= slAbs ? { ...tp, kind: "tp" } : { ...sl, kind: "sl" };
  }
  if (tp) return { ...tp, kind: "tp" };
  if (sl) return { ...sl, kind: "sl" };
  return { text: "—", reached: false, pct: null, kind: null };
}

/**
 * "off" / "6h" / "1d" / "7d" — duración del time buffer (ADR-025).
 * Acepta null y 0 como "off".
 */
export function formatBuffer(
  ms: number | null | undefined,
  t: Dict = en,
): string {
  if (!ms || ms <= 0) return t.format.bufferOff;
  const hours = ms / 3_600_000;
  if (hours < 24) {
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  }
  const days = hours / 24;
  return Number.isInteger(days) ? `${days}d` : `${days.toFixed(1)}d`;
}

/**
 * "2h 18m left" / "less than 1m left" — cuánto le queda al cronómetro del
 * buffer. Devuelve null si el buffer ya está cumplido o no aplica.
 */
export function formatBufferRemaining(
  firstCrossedAtMs: number | null,
  bufferMs: number | null | undefined,
  nowMs: number,
  t: Dict = en,
): string | null {
  if (!firstCrossedAtMs || !bufferMs || bufferMs <= 0) return null;
  const elapsed = nowMs - firstCrossedAtMs;
  const remaining = bufferMs - elapsed;
  if (remaining <= 0) return t.format.bufferMet;
  if (remaining < 60_000) return t.format.lessThan1mLeft;
  if (remaining < 3_600_000) {
    return t.format.minutesLeft(Math.floor(remaining / 60_000));
  }
  if (remaining < 86_400_000) {
    const h = Math.floor(remaining / 3_600_000);
    const m = Math.floor((remaining % 3_600_000) / 60_000);
    return t.format.hoursLeft(h, m);
  }
  const d = Math.floor(remaining / 86_400_000);
  const h = Math.floor((remaining % 86_400_000) / 3_600_000);
  return t.format.daysLeft(d, h);
}

/**
 * "SOL / devUSDC" leído del protocolConfig de una task. Desde F2.4 cada
 * task persiste tokenMintA y tokenMintB en su protocolConfig; este helper
 * los lee defensivamente y devuelve el par con sus symbols. Para tasks
 * pre-F2.4 (sin los mints) devuelve null y el caller cae al positionId
 * truncado.
 */
export function formatTaskPair(protocolConfig: unknown): string | null {
  const cfg = protocolConfig as
    | { tokenMintA?: string; tokenMintB?: string }
    | null;
  if (!cfg?.tokenMintA || !cfg?.tokenMintB) return null;
  return `${tokenSymbol(cfg.tokenMintA)} / ${tokenSymbol(cfg.tokenMintB)}`;
}

/**
 * "5m ago" / "just now" / "2h ago". timestamp en ms.
 */
export function formatTimeAgo(
  timestampMs: number | null,
  t: Dict = en,
): string {
  if (timestampMs === null) return "—";
  const diff = Date.now() - timestampMs;
  if (diff < 5_000) return t.format.justNow;
  if (diff < 60_000) return t.format.secondsAgo(Math.round(diff / 1000));
  if (diff < 3_600_000) return t.format.minutesAgo(Math.round(diff / 60_000));
  if (diff < 86_400_000) return t.format.hoursAgo(Math.round(diff / 3_600_000));
  return new Date(timestampMs).toLocaleDateString();
}

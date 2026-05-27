import { tokenColor, tokenSymbol, tokenMeta } from "@/lib/tokens";

/**
 * Placeholder visual para un token: círculo de color con el símbolo dentro
 * (1–3 letras). El color viene del registry si el token es conocido; si no,
 * se deriva del hash del mint para que sea estable y único.
 *
 * NO usa logos reales todavía — apuntado al backlog (bundlear SVGs de los
 * tokens más populares en `/public/tokens/` y servirlos desde aquí).
 */
export function TokenBadge({
  mint,
  size = 20,
  className = "",
  ringColor,
}: {
  mint: string;
  size?: number;
  className?: string;
  /**
   * Color del aro alrededor del badge. Útil para el efecto "punched out"
   * cuando dos badges se superponen (TokenPair). Default: sin aro.
   */
  ringColor?: string;
}) {
  const symbol = tokenSymbol(mint);
  const color = tokenColor(mint);
  // El symbol puede venir como truncate "ABcd…WXYZ" si no conocemos el
  // token — para el badge nos quedamos solo con los primeros 2 caracteres
  // legibles. Para conocidos, el primer carácter (S, U, J, B...) suele
  // bastar; mantenemos hasta 2 para "JUP", "RAY".
  const meta = tokenMeta(mint);
  const initials = meta
    ? meta.symbol.slice(0, meta.symbol.length <= 2 ? 2 : 1)
    : symbol.slice(0, 2).toUpperCase();

  return (
    <span
      className={`inline-flex flex-none items-center justify-center rounded-full font-bold leading-none text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.42,
        letterSpacing: "-0.02em",
        boxShadow: ringColor
          ? `0 0 0 ${Math.max(1.5, size / 12)}px ${ringColor}`
          : undefined,
      }}
      title={meta ? `${meta.symbol} · ${meta.name}` : mint}
      aria-label={meta ? meta.symbol : `Unknown token ${mint.slice(0, 8)}`}
    >
      {initials}
    </span>
  );
}

/**
 * Par de tokens superpuestos (look estándar DeFi: Orca, Meteora). El segundo
 * badge tiene un aro del color de fondo para crear el efecto "punched out".
 */
export function TokenPair({
  mintA,
  mintB,
  size = 22,
  ringColor = "var(--color-bg)",
}: {
  mintA: string;
  mintB: string;
  size?: number;
  ringColor?: string;
}) {
  return (
    <span className="inline-flex items-center flex-none">
      <TokenBadge mint={mintA} size={size} />
      <TokenBadge
        mint={mintB}
        size={size}
        className="-ml-[7px]"
        ringColor={ringColor}
      />
    </span>
  );
}

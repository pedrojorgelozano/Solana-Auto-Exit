/**
 * Banda horizontal compacta para listar posiciones en el dashboard. El
 * dominio del track es [SL, TP] (a diferencia del PriceBand del detalle,
 * cuyo dominio es [rangeMin, rangeMax] del pool); por eso vive en su
 * propio componente.
 *
 * Pura visualización: el track + el nodo del precio actual + (en active)
 * el fragmento jade hasta current. Los valores numéricos de SL y TP NO
 * se rinden aquí — viven en el stack de stats a la derecha de la fila
 * (única fuente de verdad para los números).
 */
export function TriggerBand({
  currentPrice,
  tpPrice,
  slPrice,
  state = "active",
}: {
  currentPrice: number | null;
  tpPrice: number | null;
  slPrice: number | null;
  state?: "active" | "muted";
}) {
  // Dominio del track. Si faltan triggers, usamos un dominio sintético
  // alrededor del precio actual (+/- 10%) para que el nodo no aparezca
  // siempre en un extremo.
  const lo =
    slPrice ?? (currentPrice !== null ? currentPrice * 0.9 : 0);
  const hi =
    tpPrice ?? (currentPrice !== null ? currentPrice * 1.1 : 1);
  const span = Math.max(hi - lo, 1e-9);

  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const priceX =
    currentPrice !== null ? clamp(((currentPrice - lo) / span) * 100) : 50;

  const muted = state === "muted";
  const trackBg = muted
    ? "bg-[var(--color-rule)]"
    : "bg-[var(--color-rule)]";
  const fillBg = muted
    ? "bg-[var(--color-text-dim)]/30"
    : "bg-[var(--color-accent)]/55";
  const nodeBg = muted
    ? "bg-[var(--color-text-muted)] border border-[var(--color-rule)]"
    : "bg-white border border-[var(--color-accent)]";
  const nodeGlow = muted
    ? undefined
    : "0 0 0 4px var(--color-accent-dim), 0 0 12px rgba(95,214,164,0.35)";

  return (
    <div className="relative h-[14px] w-full">
      <div className={`absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full ${trackBg}`} />
      {currentPrice !== null ? (
        <div
          className={`absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full ${fillBg}`}
          style={{ width: `${priceX}%` }}
        />
      ) : null}
      {currentPrice !== null ? (
        <div
          className={`absolute top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full ${nodeBg}`}
          style={{
            left: `${priceX}%`,
            boxShadow: nodeGlow,
          }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

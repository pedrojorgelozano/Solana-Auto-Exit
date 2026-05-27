"use client";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";
import { formatDistance, formatTimeAgo } from "@/lib/format";
import { useT } from "@/i18n/context";

type TaskRow = inferRouterOutputs<AppRouter>["tasks"]["list"][number];

const ACTIVE_STATES = ["idle", "armed", "triggered", "closing"];

/**
 * Stat strip del dashboard (rediseño "refined minimal dark"). Tres KPIs
 * calculables a partir de los datos que ya tenemos — no añade ningún
 * endpoint ni dependencia externa.
 *
 * Si no hay tasks activas, no renderiza nada (el flujo "no tasks yet" lo
 * cubre el resto del home; no aporta mostrar tres celdas con guiones).
 *
 * "Under watch $" del mockup queda fuera intencionalmente — requiere oracle
 * USD externo (Helius / Pyth / Jupiter), que es funcionalidad nueva y se
 * apunta al backlog del rediseño.
 */
export function StatStrip({ tasks }: { tasks: TaskRow[] }) {
  const { t } = useT();
  const s = t.statStrip;

  const active = tasks.filter((task) => ACTIVE_STATES.includes(task.status));

  if (active.length === 0) {
    return null;
  }

  // Nearest trigger: distancia mínima absoluta entre todas las tasks activas
  // que tengan precio actual + algún trigger configurado.
  let nearestPct: number | null = null;
  let nearestLabel: string | null = null;
  for (const task of active) {
    const current = task.runtime.lastPrice;
    if (current === null) continue;
    const candidates: Array<{ pct: number; text: string; side: "TP" | "SL" }> = [];
    if (task.takeProfitPrice !== null) {
      const d = formatDistance(current, task.takeProfitPrice, "above");
      if (d.pct !== null) candidates.push({ pct: d.pct, text: d.text, side: "TP" });
    }
    if (task.stopLossPrice !== null) {
      const d = formatDistance(current, task.stopLossPrice, "below");
      if (d.pct !== null) candidates.push({ pct: d.pct, text: d.text, side: "SL" });
    }
    for (const c of candidates) {
      if (nearestPct === null || Math.abs(c.pct) < Math.abs(nearestPct)) {
        nearestPct = c.pct;
        nearestLabel = `${c.text} → ${c.side}`;
      }
    }
  }

  // Last sync: updatedAt más reciente entre las activas. updatedAt cambia
  // cada vez que el watcher actualiza la task (precio o estado), así que es
  // una aproximación razonable de "última lectura".
  let lastSync: number | null = null;
  for (const task of active) {
    const ts = new Date(task.updatedAt).getTime();
    if (lastSync === null || ts > lastSync) lastSync = ts;
  }

  return (
    <dl
      className="
        mt-8 grid grid-cols-2 overflow-hidden rounded-[11px]
        border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)]
        md:grid-cols-3
      "
    >
      <Cell label={s.watching} value={String(active.length)} note={s.watchingNote(active.length)} />
      <Cell
        label={s.nearestTrigger}
        value={nearestLabel ?? "—"}
        valueClass="text-[var(--color-accent)]"
        note={nearestLabel ? s.nearestNote : s.nearestNoneNote}
      />
      <Cell
        label={s.lastSync}
        value={lastSync ? formatTimeAgo(lastSync, t) : "—"}
        note={s.lastSyncNote}
      />
    </dl>
  );
}

function Cell({
  label,
  value,
  note,
  valueClass = "",
}: {
  label: string;
  value: string;
  note?: string;
  valueClass?: string;
}) {
  return (
    <div className="border-l border-[var(--color-hairline)] px-5 py-4 first:border-l-0">
      <dt className="text-[11.5px] font-medium text-[var(--color-text-dim)]">
        {label}
      </dt>
      <dd className={`mt-2 text-[22px] font-semibold tracking-tight ${valueClass}`}>
        {value}
      </dd>
      {note ? (
        <span className="mt-1 block text-[12px] font-normal text-[var(--color-text-muted)]">
          {note}
        </span>
      ) : null}
    </div>
  );
}

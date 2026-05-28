"use client";

import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { taskDetailHref } from "@/lib/routes";
import { type BackendStatus } from "@/lib/status";
import {
  formatPrice,
  formatTaskPair,
  formatTimeAgo,
  formatTokenAmount,
  formatTriggers,
  truncateAddress,
} from "@/lib/format";
import { tokenMeta, tokenSymbol } from "@/lib/tokens";
import { useT } from "@/i18n/context";

type TaskRow = inferRouterOutputs<AppRouter>["tasks"]["list"][number];

/**
 * Grid template compartido entre header y filas. Si tocas las columnas,
 * tocar las dos. Anchos fijos para las cortas (status pill, closed-by,
 * when, chevron) — esto evita que la status pill larga (e.g. DETENIDO —
 * ERROR + SIM) explote el ancho y dispare scroll horizontal.
 *  status (170px) · position (130px) · trigger (1fr) · closed-by (100px)
 *  · result (1.4fr) · when (80px) · chevron (20px)
 */
const ROW_GRID =
  "grid grid-cols-[170px_130px_minmax(0,1fr)_100px_minmax(0,1.4fr)_80px_20px] items-center gap-x-4";

/**
 * Tabla de histórico. Cada fila es un Link clicable al detalle de la
 * task. Usada en `/tasks` (página Histórico) y en el bloque "Histórico
 * reciente" del dashboard. Toda la información y los estilos viven
 * aquí — una sola fuente de verdad para la fila del ledger.
 */
export function HistoryLedger({
  rows,
  showHeader = true,
}: {
  rows: TaskRow[];
  showHeader?: boolean;
}) {
  const { t } = useT();
  const c = t.tasksList.cols;

  return (
    <div>
      {showHeader ? (
        <div
          className={`
            ${ROW_GRID}
            border-b border-[var(--color-rule)]
            pb-3 t-eyebrow text-[var(--color-text-dim)]
          `}
        >
          <div>{c.status}</div>
          <div>{c.position}</div>
          <div>{c.trigger}</div>
          <div>{c.closedAt}</div>
          <div>{c.result}</div>
          <div className="text-right">{c.when}</div>
          <div />
        </div>
      ) : null}
      <ul className="flex flex-col divide-y divide-[var(--color-hairline)]">
        {rows.map((row) => (
          <li key={row.id}>
            <HistoryRow row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryRow({ row }: { row: TaskRow }) {
  const { t } = useT();
  const statusLabel =
    t.status[row.status as BackendStatus]?.label ?? row.status;
  const when = row.triggeredAt
    ? new Date(row.triggeredAt).getTime()
    : new Date(row.updatedAt).getTime();

  const pair = formatTaskPair(row.protocolConfig);
  const cfg = row.protocolConfig as
    | {
        tokenMintA?: string;
        tokenMintB?: string;
        decimalsA?: number;
        decimalsB?: number;
      }
    | null;
  const mintA = cfg?.tokenMintA;
  const mintB = cfg?.tokenMintB;
  const decA = cfg?.decimalsA ?? tokenMeta(mintA ?? "")?.decimals ?? 9;
  const decB = cfg?.decimalsB ?? tokenMeta(mintB ?? "")?.decimals ?? 9;

  // Trigger que disparó el cierre. Aproximación pragmática: usamos el
  // trigger configurado, no el precio efectivo del swap (que pudo
  // diferir por slippage). Para escaneo cumple.
  const closedBy = (() => {
    if (row.triggeredBy === "take_profit" && row.takeProfitPrice !== null) {
      return { kind: "tp", price: row.takeProfitPrice } as const;
    }
    if (row.triggeredBy === "stop_loss" && row.stopLossPrice !== null) {
      return { kind: "sl", price: row.stopLossPrice } as const;
    }
    return null;
  })();

  const resultNode = (() => {
    if (row.status === "error" && row.lastError) {
      return (
        <span
          className="text-[var(--color-warning)]"
          title={row.lastError}
        >
          {truncateMessage(row.lastError, 48)}
        </span>
      );
    }
    const close = row.closeResult as
      | { withdrawnA?: string; withdrawnB?: string }
      | null;
    const swap = row.swapResult as
      | { outAmount?: string; outMint?: string }
      | null;
    if (
      close &&
      (close.withdrawnA || close.withdrawnB) &&
      mintA &&
      mintB
    ) {
      const aStr = close.withdrawnA
        ? `${formatTokenAmount(close.withdrawnA, decA, 4)} ${tokenSymbol(mintA)}`
        : null;
      const bStr = close.withdrawnB
        ? `${formatTokenAmount(close.withdrawnB, decB, 4)} ${tokenSymbol(mintB)}`
        : null;
      const parts = [aStr, bStr].filter(Boolean).join(" · ");
      const swapStr =
        swap && swap.outAmount && swap.outMint
          ? ` → ${formatTokenAmount(
              swap.outAmount,
              tokenMeta(swap.outMint)?.decimals ?? 9,
              4,
            )} ${tokenSymbol(swap.outMint)}`
          : "";
      return (
        <span className="t-num text-[var(--color-text)]">
          {parts}
          {swapStr ? (
            <span className="text-[var(--color-text-muted)]">{swapStr}</span>
          ) : null}
        </span>
      );
    }
    return <span className="t-num text-[var(--color-text-dim)]">—</span>;
  })();

  return (
    <Link
      href={taskDetailHref(row.id)}
      className={`
        group ${ROW_GRID}
        cursor-pointer py-4
        transition-colors
        hover:bg-[var(--color-surface-hover)]/50
      `}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusPillCompact
          status={row.status as BackendStatus}
          label={statusLabel}
        />
        {row.dryRun ? <SimTag /> : null}
      </div>
      <div>
        <div className="text-[var(--color-text)]">
          {pair ?? (
            <span className="t-num">
              {truncateAddress(row.positionId, 4, 4)}
            </span>
          )}
        </div>
        <div className="mt-1 t-eyebrow text-[var(--color-text-dim)]">
          {row.protocol}
        </div>
      </div>
      <div className="t-num text-[var(--color-text)]">
        {formatTriggers(row.takeProfitPrice, row.stopLossPrice, 4)}
        {row.exitTokenMint ? (
          <span className="ml-2 t-eyebrow text-[var(--color-text-dim)]">
            → {tokenSymbol(row.exitTokenMint)}
          </span>
        ) : null}
      </div>
      <div>
        {closedBy ? (
          <span
            className={`t-num ${
              closedBy.kind === "tp"
                ? "text-[var(--color-accent-bright)]"
                : "text-[var(--color-warning)]"
            }`}
          >
            {closedBy.kind === "tp" ? "TP" : "SL"}
            <span className="mx-1 text-[var(--color-text-muted)]">·</span>
            {formatPrice(closedBy.price)}
          </span>
        ) : (
          <span className="t-num text-[var(--color-text-dim)]">—</span>
        )}
      </div>
      <div className="min-w-0">{resultNode}</div>
      <div className="t-small text-right text-[var(--color-text-muted)]">
        {formatTimeAgo(when, t)}
      </div>
      <div
        className="
          text-[var(--color-text-dim)] transition-all duration-200
          group-hover:translate-x-[3px] group-hover:text-[var(--color-accent-bright)]
        "
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[18px] w-[18px]"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </div>
    </Link>
  );
}

/**
 * Pill enriquecida del estado en la fila de histórico — coherente
 * cromáticamente con la StatusPill del dashboard pero ajustada a
 * contexto de tabla densa (sin pulse-soft porque las tasks históricas
 * no están vivas).
 */
function StatusPillCompact({
  status,
  label,
}: {
  status: BackendStatus;
  label: string;
}) {
  const cls =
    status === "done"
      ? "border-[var(--color-accent)]/35 bg-[var(--color-accent)]/12 text-[var(--color-accent-bright)]"
      : status === "error"
        ? "border-[var(--color-danger)]/45 bg-[var(--color-danger)]/12 text-[var(--color-danger)]"
        : "border-[var(--color-rule)] bg-[var(--color-text-dim)]/12 text-[var(--color-text-muted)]";
  const dotCls =
    status === "done"
      ? "bg-[var(--color-accent)]"
      : status === "error"
        ? "bg-[var(--color-danger)]"
        : "bg-[var(--color-text-muted)]";
  return (
    <span
      className={`
        inline-flex items-center gap-2 rounded-full border
        px-2.5 py-[3px]
        text-[11px] font-semibold uppercase tracking-[0.16em]
        ${cls}
      `}
    >
      <span
        className={`inline-block h-[6px] w-[6px] rounded-full ${dotCls}`}
        aria-hidden
      />
      {label}
    </span>
  );
}

/**
 * Tag pequeño "Simulado" — se renderiza al lado del status pill cuando
 * la task se creó en modo dry-run. Fuera de la pill para no romperla
 * a multilinea y para que tenga presencia propia (es info importante:
 * el resultado del cierre NO se ejecutó realmente).
 */
function SimTag() {
  const { t } = useT();
  return (
    <span
      title={t.format.simTooltip}
      className="
        inline-flex items-center
        text-[10px] font-semibold uppercase tracking-[0.18em]
        text-[var(--color-warning)]
      "
    >
      {t.format.sim}
    </span>
  );
}

function truncateMessage(msg: string, max: number): string {
  if (msg.length <= max) return msg;
  return msg.slice(0, max - 1) + "…";
}

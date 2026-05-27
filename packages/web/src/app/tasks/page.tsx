"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { taskDetailHref } from "@/lib/routes";
import { statusView, TONE_CLASSES, type BackendStatus } from "@/lib/status";
import {
  formatDistance,
  formatPrice,
  formatTaskPair,
  formatTimeAgo,
  formatTriggers,
  truncateAddress,
} from "@/lib/format";
import { tokenSymbol } from "@/lib/tokens";
import { TokenPair } from "@/components/TokenBadge";
import { useT } from "@/i18n/context";

type TaskRow = inferRouterOutputs<AppRouter>["tasks"]["list"][number];
type Filter = "all" | "active" | "completed" | "errors";

export default function TasksListPage() {
  const list = trpc.tasks.list.useQuery(undefined, { refetchInterval: 3_000 });
  const [filter, setFilter] = useState<Filter>("all");
  const { t } = useT();
  const tl = t.tasksList;

  const rows = list.data ?? [];
  const filtered = useMemo(() => filterRows(rows, filter), [rows, filter]);
  const counts = useMemo(() => countByFilter(rows), [rows]);

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-12 fade-in">
      <PageHeader
        eyebrow={tl.pageEyebrow}
        title={tl.pageTitle}
        description={tl.pageDescription}
        back={{ href: "/", label: tl.backLabel }}
      />

      {list.isLoading ? (
        <p className="t-small text-[var(--color-text-muted)]">
          {t.common.loading}
        </p>
      ) : list.error ? (
        <p className="t-small text-[var(--color-danger)]">{list.error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <Filters value={filter} onChange={setFilter} counts={counts} />
          {filtered.length === 0 ? (
            <p className="mt-10 t-small text-[var(--color-text-muted)]">
              {tl.noMatch}
            </p>
          ) : (
            <Ledger rows={filtered} />
          )}
        </>
      )}
    </main>
  );
}

function EmptyState() {
  const { t } = useT();
  const tl = t.tasksList;
  return (
    <section className="hairline-t pt-10">
      <div className="t-eyebrow text-[var(--color-text-muted)]">
        {tl.emptyEyebrow}
      </div>
      <h2 className="mt-3 t-h2">{tl.emptyTitle}</h2>
      <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
        {tl.emptyBody}
      </p>
      <div className="mt-6">
        <Link href="/">
          <Button>{tl.emptyCta}</Button>
        </Link>
      </div>
    </section>
  );
}

// ============================================================================
// Filters
// ============================================================================

function Filters({
  value,
  onChange,
  counts,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
  counts: Record<Filter, number>;
}) {
  const { t } = useT();
  const f = t.tasksList.filters;
  const opts: { value: Filter; label: string }[] = [
    { value: "all", label: f.all },
    { value: "active", label: f.active },
    { value: "completed", label: f.completed },
    { value: "errors", label: f.errors },
  ];
  return (
    <div className="hairline-b mb-6 flex items-baseline justify-between pb-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {opts.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`t-eyebrow transition-colors ${
                active
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {opt.label}
              <span className="ml-2 t-num text-[var(--color-text-dim)]">
                {counts[opt.value]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Ledger table
// ============================================================================

function Ledger({ rows }: { rows: TaskRow[] }) {
  const { t } = useT();
  const c = t.tasksList.cols;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left t-eyebrow text-[var(--color-text-dim)]">
            <th className="pb-4 pr-4 font-normal">{c.status}</th>
            <th className="pb-4 pr-4 font-normal">{c.position}</th>
            <th className="pb-4 pr-4 font-normal">{c.trigger}</th>
            <th className="pb-4 pr-4 font-normal">{c.lastPrice}</th>
            <th className="pb-4 pr-4 font-normal text-right">{c.distance}</th>
            <th className="pb-4 pr-4 font-normal text-right">{c.when}</th>
            <th className="pb-4 font-normal text-right">&nbsp;</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-hairline)] border-t border-[var(--color-rule)]">
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row }: { row: TaskRow }) {
  const { t } = useT();
  const view = statusView(row.status as BackendStatus);
  const tone = TONE_CLASSES[view.tone];
  const statusLabel =
    t.status[row.status as BackendStatus]?.label ?? row.status;
  // Doble distancia (TP + SL): coherente con la celda Auto-exit del home.
  // Si solo hay un trigger, solo se renderiza ese.
  const current = row.runtime.lastPrice;
  const tpDist =
    row.takeProfitPrice !== null
      ? formatDistance(current, row.takeProfitPrice, "above")
      : null;
  const slDist =
    row.stopLossPrice !== null
      ? formatDistance(current, row.stopLossPrice, "below")
      : null;
  const when = row.triggeredAt
    ? new Date(row.triggeredAt).getTime()
    : new Date(row.updatedAt).getTime();

  // Resolver el ref de la posición para mostrar el rango (distinguir
  // posiciones del mismo pool en pool-trading). wallet.status y listOwned
  // tienen las MISMAS query keys entre rows → TanStack Query las deduplica
  // automáticamente, así que el coste de RPC es 1 por (protocol, network,
  // rpcUrl) único, no 1 por row. El getSummary sí es único por row.
  const walletStatus = trpc.wallet.status.useQuery();
  const owner = walletStatus.data?.address;
  const list = trpc.positions.listOwned.useQuery(
    {
      protocol: row.protocol,
      network: row.network,
      rpcUrl: row.rpcUrl,
      owner: owner ?? "",
    },
    { enabled: !!owner },
  );
  const ref = list.data?.find((r) => r.id === row.positionId);
  const summary = trpc.positions.getSummary.useQuery(
    {
      protocol: row.protocol,
      network: row.network,
      rpcUrl: row.rpcUrl,
      ref: ref ?? { protocol: "", id: "", label: "", poolId: "" },
    },
    { enabled: !!ref, refetchInterval: 30_000 },
  );

  const pair = formatTaskPair(row.protocolConfig);
  const cfg = row.protocolConfig as
    | { tokenMintA?: string; tokenMintB?: string }
    | null;
  const mintA = cfg?.tokenMintA;
  const mintB = cfg?.tokenMintB;

  // dist-bar: width inversamente proporcional a la distancia al trigger
  // más cercano. Más cerca = barra más llena. 0% = barra vacía (lejos),
  // 100% = barra llena (en el trigger). Cap a 100% para safety.
  const nearestPct = (() => {
    const candidates = [tpDist?.pct, slDist?.pct].filter(
      (v): v is number => v !== null && v !== undefined,
    );
    if (candidates.length === 0) return null;
    return Math.min(...candidates.map((v) => Math.abs(v)));
  })();
  const distBarFill =
    nearestPct === null
      ? 0
      : Math.max(0, Math.min(100, 100 - nearestPct));
  const distBarReached =
    (tpDist?.reached ?? false) || (slDist?.reached ?? false);

  return (
    <tr className="group transition-colors hover:bg-[var(--color-surface-hover)]">
      <td className="py-4 pr-4 align-baseline">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${tone.dot} ${
              view.pulsing ? "pulse-soft" : ""
            }`}
          />
          <span className={`t-eyebrow ${tone.text}`}>{statusLabel}</span>
          {row.dryRun ? (
            <span className="t-eyebrow text-[var(--color-warning)]">
              {t.format.sim}
            </span>
          ) : null}
        </div>
      </td>
      <td className="py-4 pr-4 align-baseline">
        <div className="flex items-center gap-2.5">
          {mintA && mintB ? (
            <TokenPair mintA={mintA} mintB={mintB} size={20} />
          ) : null}
          <div>
            <div className="text-[var(--color-text)]">
              {pair ?? (
                <span className="t-num">
                  {truncateAddress(row.positionId, 4, 4)}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              {summary.data ? (
                <>
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      summary.data.isInRange
                        ? "bg-[var(--color-positive)]"
                        : "bg-[var(--color-danger)]"
                    }`}
                    title={
                      summary.data.isInRange
                        ? t.format.inRange
                        : t.format.outOfRange
                    }
                  />
                  <span className="t-num text-xs text-[var(--color-text-muted)]">
                    {formatPrice(summary.data.range.min, 2)}
                    <span className="text-[var(--color-text-dim)]">–</span>
                    {formatPrice(summary.data.range.max, 2)}
                  </span>
                  <span className="t-eyebrow text-[var(--color-text-dim)]">·</span>
                  <span className="t-eyebrow text-[var(--color-text-dim)]">
                    {row.protocol}
                  </span>
                </>
              ) : (
                <span className="t-eyebrow text-[var(--color-text-dim)]">
                  {row.protocol}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="py-4 pr-4 align-baseline t-num text-[var(--color-text)]">
        {formatTriggers(row.takeProfitPrice, row.stopLossPrice, 4)}
        {row.exitTokenMint ? (
          <span className="ml-2 t-eyebrow text-[var(--color-text-dim)]">
            → {tokenSymbol(row.exitTokenMint)}
          </span>
        ) : null}
      </td>
      <td className="py-4 pr-4 align-baseline t-num text-[var(--color-text)]">
        {row.runtime.lastPrice !== null
          ? formatPrice(row.runtime.lastPrice, 4)
          : "—"}
      </td>
      <td className="py-4 pr-4 align-baseline text-right">
        {(tpDist && tpDist.pct !== null) || (slDist && slDist.pct !== null) ? (
          <div className="flex flex-col items-end gap-1">
            {nearestPct !== null ? (
              <span
                className="block h-[4px] w-[46px] overflow-hidden rounded-[2px] bg-[var(--color-hairline)]"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-[2px]"
                  style={{
                    width: `${distBarFill}%`,
                    background: distBarReached
                      ? "var(--color-warning)"
                      : "var(--color-accent)",
                  }}
                />
              </span>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 t-num">
              {tpDist && tpDist.pct !== null ? (
                <span
                  className={
                    tpDist.reached
                      ? "text-[var(--color-warning)]"
                      : "text-[var(--color-text-muted)]"
                  }
                >
                  {tpDist.text} TP
                </span>
              ) : null}
              {tpDist?.pct !== null && slDist?.pct !== null ? (
                <span className="t-eyebrow text-[var(--color-text-dim)]">·</span>
              ) : null}
              {slDist && slDist.pct !== null ? (
                <span
                  className={
                    slDist.reached
                      ? "text-[var(--color-warning)]"
                      : "text-[var(--color-text-muted)]"
                  }
                >
                  {slDist.text} SL
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <span className="t-num text-[var(--color-text-dim)]">—</span>
        )}
      </td>
      <td className="py-4 pr-4 align-baseline t-small text-right text-[var(--color-text-muted)]">
        {formatTimeAgo(when, t)}
      </td>
      <td className="py-4 align-baseline text-right">
        <Link
          href={taskDetailHref(row.id)}
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)]"
        >
          {t.common.open}
        </Link>
      </td>
    </tr>
  );
}

// ============================================================================
// Helpers
// ============================================================================

const ACTIVE_STATES = new Set(["idle", "armed", "triggered", "closing", "paused"]);
const COMPLETED_STATES = new Set(["done", "stopped"]);

function filterRows(rows: TaskRow[], f: Filter): TaskRow[] {
  if (f === "all") return rows;
  if (f === "active") return rows.filter((r) => ACTIVE_STATES.has(r.status));
  if (f === "completed") return rows.filter((r) => COMPLETED_STATES.has(r.status));
  if (f === "errors") return rows.filter((r) => r.status === "error");
  return rows;
}

function countByFilter(rows: TaskRow[]): Record<Filter, number> {
  return {
    all: rows.length,
    active: rows.filter((r) => ACTIVE_STATES.has(r.status)).length,
    completed: rows.filter((r) => COMPLETED_STATES.has(r.status)).length,
    errors: rows.filter((r) => r.status === "error").length,
  };
}

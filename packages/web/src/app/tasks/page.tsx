"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
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

type TaskRow = inferRouterOutputs<AppRouter>["tasks"]["list"][number];
type Filter = "all" | "active" | "completed" | "errors";

export default function TasksListPage() {
  const list = trpc.tasks.list.useQuery(undefined, { refetchInterval: 3_000 });
  const [filter, setFilter] = useState<Filter>("all");

  const rows = list.data ?? [];
  const filtered = useMemo(() => filterRows(rows, filter), [rows, filter]);
  const counts = useMemo(() => countByFilter(rows), [rows]);

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-12 fade-in">
      <PageHeader
        eyebrow="History"
        title="All auto-exits."
        description="Active, paused, completed and errored — everything this server knows about."
        back={{ href: "/", label: "Home" }}
      />

      {list.isLoading ? (
        <p className="t-small text-[var(--color-text-muted)]">Loading…</p>
      ) : list.error ? (
        <p className="t-small text-[var(--color-danger)]">{list.error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <Filters value={filter} onChange={setFilter} counts={counts} />
          {filtered.length === 0 ? (
            <p className="mt-10 t-small text-[var(--color-text-muted)]">
              No auto-exits match this filter.
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
  return (
    <section className="hairline-t pt-10">
      <div className="t-eyebrow text-[var(--color-text-muted)]">Empty</div>
      <h2 className="mt-3 t-h2">No auto-exits yet.</h2>
      <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
        An auto-exit watches a single LP position and closes it when your
        take-profit or stop-loss price hits. Configure one on any position
        the bot wallet owns — it will appear here from creation through
        completion, including dry-run simulations.
      </p>
      <div className="mt-6">
        <Link href="/">
          <Button>Go to positions →</Button>
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
  const opts: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "errors", label: "Errors" },
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left t-eyebrow text-[var(--color-text-dim)]">
            <th className="pb-4 pr-4 font-normal">Status</th>
            <th className="pb-4 pr-4 font-normal">Position</th>
            <th className="pb-4 pr-4 font-normal">Trigger</th>
            <th className="pb-4 pr-4 font-normal">Last price</th>
            <th className="pb-4 pr-4 font-normal text-right">Distance</th>
            <th className="pb-4 pr-4 font-normal text-right">When</th>
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
  const view = statusView(row.status as BackendStatus);
  const tone = TONE_CLASSES[view.tone];
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

  return (
    <tr className="group">
      <td className="py-4 pr-4 align-baseline">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${tone.dot} ${
              view.pulsing ? "pulse-soft" : ""
            }`}
          />
          <span className={`t-eyebrow ${tone.text}`}>{view.label}</span>
          {row.dryRun ? (
            <span className="t-eyebrow text-[var(--color-warning)]">· sim</span>
          ) : null}
        </div>
      </td>
      <td className="py-4 pr-4 align-baseline">
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
                  summary.data.isInRange ? "In your range" : "Out of range"
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
        ) : (
          <span className="t-num text-[var(--color-text-dim)]">—</span>
        )}
      </td>
      <td className="py-4 pr-4 align-baseline t-small text-right text-[var(--color-text-muted)]">
        {formatTimeAgo(when)}
      </td>
      <td className="py-4 align-baseline text-right">
        <Link
          href={`/tasks/${row.id}`}
          className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)]"
        >
          open →
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

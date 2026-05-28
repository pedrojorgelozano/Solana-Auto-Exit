"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { HistoryLedger } from "@/components/HistoryLedger";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n/context";

type TaskRow = inferRouterOutputs<AppRouter>["tasks"]["list"][number];
type Filter = "completed" | "errors";

export default function TasksListPage() {
  // useSearchParams requiere Suspense boundary en Next 15 para el static
  // bailout en build. fallback null porque el contenido carga rápido y
  // no merece skeleton.
  return (
    <Suspense fallback={null}>
      <TasksListInner />
    </Suspense>
  );
}

function TasksListInner() {
  const list = trpc.tasks.list.useQuery(undefined, { refetchInterval: 3_000 });
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<Filter>(() => {
    const fp = searchParams.get("filter");
    return fp === "errors" ? "errors" : "completed";
  });
  // Sincroniza filter cuando cambia el query (permite deep-links desde
  // callouts del dashboard sin remontar la página).
  useEffect(() => {
    const fp = searchParams.get("filter");
    if (fp === "errors") setFilter("errors");
    else if (fp === "completed") setFilter("completed");
  }, [searchParams]);
  const { t } = useT();
  const tl = t.tasksList;

  const rows = list.data ?? [];
  // Ledger histórico: solo tasks cerradas (done/stopped) o erradas. Las
  // active/paused viven en el dashboard — esta pantalla es el pasado.
  const historicalRows = useMemo(
    () => rows.filter((r) => HISTORICAL_STATES.has(r.status)),
    [rows],
  );
  const filtered = useMemo(
    () => filterRows(historicalRows, filter),
    [historicalRows, filter],
  );
  const counts = useMemo(() => countByFilter(historicalRows), [historicalRows]);

  return (
    <main className="mr-auto max-w-5xl px-6 pb-32 pt-12 fade-in">
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
      ) : historicalRows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <Filters value={filter} onChange={setFilter} counts={counts} />
          {filtered.length === 0 ? (
            <p className="mt-10 t-small text-[var(--color-text-muted)]">
              {tl.noMatch}
            </p>
          ) : (
            <HistoryLedger rows={filtered} />
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
    { value: "completed", label: f.completed },
    { value: "errors", label: f.errors },
  ];
  return (
    <div className="mb-6 flex flex-wrap gap-x-1 gap-y-1 border-b border-[var(--color-hairline)]">
      {opts.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`
              relative t-eyebrow
              px-3 pb-3 pt-2
              transition-colors
              ${
                active
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]/40 hover:text-[var(--color-text)]"
              }
            `}
          >
            {opt.label}
            <span
              className={`ml-2 t-num ${
                active
                  ? "text-[var(--color-text-muted)]"
                  : "text-[var(--color-text-dim)]"
              }`}
            >
              ({counts[opt.value]})
            </span>
            {active ? (
              <span
                aria-hidden
                className="absolute -bottom-px left-2 right-2 h-[2px] rounded-full bg-[var(--color-accent)]"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

const COMPLETED_STATES = new Set(["done", "stopped"]);
const HISTORICAL_STATES = new Set(["done", "stopped", "error"]);

function filterRows(rows: TaskRow[], f: Filter): TaskRow[] {
  if (f === "completed") return rows.filter((r) => COMPLETED_STATES.has(r.status));
  if (f === "errors") return rows.filter((r) => r.status === "error");
  return rows;
}

function countByFilter(rows: TaskRow[]): Record<Filter, number> {
  return {
    completed: rows.filter((r) => COMPLETED_STATES.has(r.status)).length,
    errors: rows.filter((r) => r.status === "error").length,
  };
}

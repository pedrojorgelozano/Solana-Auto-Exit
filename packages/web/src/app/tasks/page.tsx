"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { HistoryLedger } from "@/components/HistoryLedger";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n/context";

type Filter = "completed" | "errors";

const PAGE_SIZE = 50;
const STATIC_RUNTIME = {
  isRunning: false,
  lastPrice: null,
  lastTickAt: null,
  tpFirstCrossedAt: null,
  slFirstCrossedAt: null,
} as const;

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

  // Paginación server-side con cursor. tasks.list cargaba TODO el array
  // y `/tasks` lo filtraba localmente — escalaba mal con cientos de
  // tasks históricas. Ahora el server filtra por status y devuelve
  // hasta PAGE_SIZE rows; "Load more" trae la siguiente página.
  const list = trpc.tasks.listHistorical.useInfiniteQuery(
    { limit: PAGE_SIZE, filter },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      refetchInterval: 5_000,
    },
  );
  const counts = trpc.tasks.historicalCounts.useQuery(undefined, {
    refetchInterval: 5_000,
  });
  const countsData = counts.data ?? { completed: 0, errors: 0 };
  // HistoryLedger espera el shape de `tasks.list` con `runtime`. Las
  // históricas no tienen watcher vivo, así que añadimos un runtime
  // estático para satisfacer el tipo sin enriquecer en backend.
  const rows = (list.data?.pages.flatMap((p) => p.items) ?? []).map((r) => ({
    ...r,
    runtime: STATIC_RUNTIME,
  }));

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
      ) : countsData.completed + countsData.errors === 0 ? (
        <EmptyState />
      ) : (
        <>
          <Filters value={filter} onChange={setFilter} counts={countsData} />
          {rows.length === 0 ? (
            <p className="mt-10 t-small text-[var(--color-text-muted)]">
              {tl.noMatch}
            </p>
          ) : (
            <>
              <HistoryLedger rows={rows} />
              {list.hasNextPage ? (
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => list.fetchNextPage()}
                    disabled={list.isFetchingNextPage}
                  >
                    {list.isFetchingNextPage ? tl.loadingMore : tl.loadMore}
                  </Button>
                </div>
              ) : null}
            </>
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


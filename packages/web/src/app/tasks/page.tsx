"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardLabel } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { formatPrice, truncateAddress } from "@/lib/format";

const STATUS_PILL: Record<string, string> = {
  idle: "bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]",
  armed: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  triggered: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  closing: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  done: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  error: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
  paused: "bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]",
  stopped: "bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]",
};

export default function TasksListPage() {
  const list = trpc.tasks.list.useQuery(undefined, { refetchInterval: 3_000 });

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <PageHeader
        title="Tasks"
        description="All auto-exit watchers that this server knows about."
        back={{ href: "/", label: "Home" }}
      />

      {list.isLoading ? (
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
        </Card>
      ) : list.error ? (
        <Card variant="danger">
          <p className="text-sm text-[var(--color-danger)]">
            {list.error.message}
          </p>
        </Card>
      ) : !list.data || list.data.length === 0 ? (
        <Card>
          <CardLabel>No tasks yet</CardLabel>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Create one from a position to start watching.
          </p>
          <div className="mt-4">
            <Link href="/positions">
              <Button>Go to Positions →</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.data.map((t) => (
            <Link key={t.id} href={`/tasks/${t.id}`}>
              <Card className="cursor-pointer transition-colors hover:border-[var(--color-accent)]/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                          STATUS_PILL[t.status] ?? STATUS_PILL.idle
                        }`}
                      >
                        {t.status}
                      </span>
                      {t.dryRun ? (
                        <span className="rounded bg-[var(--color-warning)]/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-warning)]">
                          dry-run
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 font-mono text-xs text-[var(--color-text-muted)]">
                      {t.protocol} · {truncateAddress(t.positionId, 6, 6)}
                    </div>
                    <div className="mt-2 text-sm">
                      {t.direction} {formatPrice(t.targetPrice, 6)}
                      {t.runtime.lastPrice !== null ? (
                        <span className="ml-3 text-[var(--color-text-muted)]">
                          last: {formatPrice(t.runtime.lastPrice, 6)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

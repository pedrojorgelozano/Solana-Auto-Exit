"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardLabel } from "@/components/ui/Card";
import { trpc } from "@/lib/trpc";

/**
 * Placeholder de F1.5: muestra el task tal cual viene de tasks.get.
 * F1.6 lo convierte en dashboard en vivo (status, último precio, log de
 * eventos, controles pause/stop/delete).
 */
export default function TaskPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const task = trpc.tasks.get.useQuery({ id }, { refetchInterval: 2_000 });

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <PageHeader
        title="Task"
        description="Live status. Dashboard with controls comes in F1.6."
        back={{ href: "/positions", label: "Positions" }}
      />

      {task.isLoading ? (
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
        </Card>
      ) : task.error ? (
        <Card variant="danger">
          <p className="text-sm text-[var(--color-danger)]">
            {task.error.message}
          </p>
        </Card>
      ) : task.data ? (
        <Card>
          <CardLabel>{task.data.status}</CardLabel>
          <pre className="mt-4 overflow-auto text-xs text-[var(--color-text)]">
            {JSON.stringify(task.data, null, 2)}
          </pre>
        </Card>
      ) : null}
    </main>
  );
}

"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardLabel, FieldError } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { formatPrice, formatTokenAmount, truncateAddress } from "@/lib/format";

type TaskData = inferRouterOutputs<AppRouter>["tasks"]["get"];

type TaskStatus =
  | "idle"
  | "armed"
  | "triggered"
  | "closing"
  | "done"
  | "error"
  | "paused"
  | "stopped";

const STATUS_COLOR: Record<TaskStatus, { dot: string; text: string; bg: string }> = {
  idle: {
    dot: "bg-[var(--color-text-muted)]",
    text: "text-[var(--color-text-muted)]",
    bg: "bg-[var(--color-text-muted)]/10",
  },
  armed: {
    dot: "bg-[var(--color-success)] animate-pulse",
    text: "text-[var(--color-success)]",
    bg: "bg-[var(--color-success)]/10",
  },
  triggered: {
    dot: "bg-[var(--color-warning)] animate-pulse",
    text: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-warning)]/10",
  },
  closing: {
    dot: "bg-[var(--color-warning)] animate-pulse",
    text: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-warning)]/10",
  },
  done: {
    dot: "bg-[var(--color-success)]",
    text: "text-[var(--color-success)]",
    bg: "bg-[var(--color-success)]/10",
  },
  error: {
    dot: "bg-[var(--color-danger)]",
    text: "text-[var(--color-danger)]",
    bg: "bg-[var(--color-danger)]/10",
  },
  paused: {
    dot: "bg-[var(--color-text-muted)]",
    text: "text-[var(--color-text-muted)]",
    bg: "bg-[var(--color-text-muted)]/10",
  },
  stopped: {
    dot: "bg-[var(--color-text-muted)]",
    text: "text-[var(--color-text-muted)]",
    bg: "bg-[var(--color-text-muted)]/10",
  },
};

export default function TaskPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const utils = trpc.useUtils();
  const task = trpc.tasks.get.useQuery({ id }, { refetchInterval: 2_000 });

  const refresh = () => utils.tasks.get.invalidate({ id });

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <PageHeader
        title="Task"
        description="Live status of your auto-exit watcher."
        back={{ href: "/tasks", label: "All tasks" }}
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
        <Dashboard task={task.data} refresh={refresh} />
      ) : null}
    </main>
  );
}

// ============================================================================
// Dashboard
// ============================================================================

function Dashboard({ task, refresh }: { task: TaskData; refresh: () => void }) {
  const status = task.status as TaskStatus;
  const palette = STATUS_COLOR[status] ?? STATUS_COLOR.idle;

  const protocolConfig = task.protocolConfig as
    | { positionMint?: string; decimalsA?: number; decimalsB?: number }
    | null;
  const decimalsA = protocolConfig?.decimalsA ?? 9;
  const decimalsB = protocolConfig?.decimalsB ?? 6;

  return (
    <div className="space-y-4">
      {/* Status header */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardLabel>Auto-exit · {task.protocol}</CardLabel>
            <div className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">
              position {truncateAddress(task.positionId, 6, 6)}
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${palette.bg} ${palette.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
            {status}
            {task.dryRun ? (
              <span className="ml-1 rounded bg-[var(--color-warning)]/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-warning)]">
                dry-run
              </span>
            ) : null}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Field label="Direction">{task.direction}</Field>
          <Field label="Target price">{formatPrice(task.targetPrice, 6)}</Field>
          <Field label="Current price">
            {task.runtime.lastPrice !== null
              ? formatPrice(task.runtime.lastPrice, 6)
              : "—"}
          </Field>
          <Field label="Distance to target">
            <DistanceCell
              current={task.runtime.lastPrice}
              target={task.targetPrice}
              direction={task.direction}
            />
          </Field>
          <Field label="Last tick">
            {task.runtime.lastTickAt
              ? new Date(task.runtime.lastTickAt).toLocaleTimeString()
              : "—"}
          </Field>
          <Field label="Poll interval">{task.pollMs} ms</Field>
        </div>

        <Controls task={task} status={status} refresh={refresh} />
      </Card>

      {task.lastError ? (
        <Card variant="danger">
          <CardLabel>Last error</CardLabel>
          <p className="mt-2 break-words text-sm text-[var(--color-danger)]">
            {task.lastError}
          </p>
        </Card>
      ) : null}

      {task.closeResult ? (
        <CloseResultCard
          data={task.closeResult as CloseResultShape}
          decimalsA={decimalsA}
          decimalsB={decimalsB}
        />
      ) : null}

      {task.swapResult ? (
        <SwapResultCard
          data={task.swapResult as SwapResultShape}
          exitTokenMint={task.exitTokenMint}
          decimalsA={decimalsA}
          decimalsB={decimalsB}
        />
      ) : null}
    </div>
  );
}

// ============================================================================
// Controls (pause / stop / delete / start)
// ============================================================================

function Controls({
  task,
  status,
  refresh,
}: {
  task: TaskData;
  status: TaskStatus;
  refresh: () => void;
}) {
  const start = trpc.tasks.start.useMutation({ onSuccess: refresh });
  const pause = trpc.tasks.pause.useMutation({ onSuccess: refresh });
  const stop = trpc.tasks.stop.useMutation({ onSuccess: refresh });
  const del = trpc.tasks.delete.useMutation({ onSuccess: refresh });

  const busy =
    start.isPending || pause.isPending || stop.isPending || del.isPending;
  const err =
    start.error?.message ??
    pause.error?.message ??
    stop.error?.message ??
    del.error?.message ??
    null;

  const isActive =
    status === "armed" || status === "triggered" || status === "closing";
  const canStart = status === "paused" || status === "idle" || status === "error";

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canStart ? (
          <Button onClick={() => start.mutate({ id: task.id })} disabled={busy}>
            {status === "error" ? "Restart" : "Start"}
          </Button>
        ) : null}
        {isActive ? (
          <Button
            variant="secondary"
            onClick={() => pause.mutate({ id: task.id })}
            disabled={busy}
          >
            Pause
          </Button>
        ) : null}
        {status !== "done" && status !== "stopped" ? (
          <Button
            variant="secondary"
            onClick={() => stop.mutate({ id: task.id })}
            disabled={busy}
          >
            Stop
          </Button>
        ) : null}
        <Button
          variant="danger"
          onClick={() => {
            if (
              confirm("Delete this task? History row is removed too.")
            ) {
              del.mutate({ id: task.id });
            }
          }}
          disabled={busy}
        >
          Delete
        </Button>
      </div>
      {err ? <FieldError>{err}</FieldError> : null}
    </div>
  );
}

// ============================================================================
// Result cards
// ============================================================================

interface CloseResultShape {
  dryRun: boolean;
  txId?: string;
  estimatedTokenA?: string;
  estimatedTokenB?: string;
  feesTokenA?: string;
  feesTokenB?: string;
  notes?: string;
}

interface SwapResultShape {
  dryRun: boolean;
  skipped: boolean;
  txId?: string;
  fromMint?: string;
  inputAmount?: string;
  estimatedOutput?: string;
  minimumOutput?: string;
  notes?: string;
}

function CloseResultCard({
  data,
  decimalsA,
  decimalsB,
}: {
  data: CloseResultShape;
  decimalsA: number;
  decimalsB: number;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardLabel>Close result {data.dryRun ? "· dry-run" : ""}</CardLabel>
        {data.txId ? <SolscanLink sig={data.txId} /> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Field label="Token A received">
          {formatTokenAmount(data.estimatedTokenA, decimalsA)}
        </Field>
        <Field label="Token B received">
          {formatTokenAmount(data.estimatedTokenB, decimalsB)}
        </Field>
        <Field label="Fees A">
          {formatTokenAmount(data.feesTokenA, decimalsA)}
        </Field>
        <Field label="Fees B">
          {formatTokenAmount(data.feesTokenB, decimalsB)}
        </Field>
      </div>
      {data.notes ? (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          {data.notes}
        </p>
      ) : null}
    </Card>
  );
}

function SwapResultCard({
  data,
  exitTokenMint,
  decimalsA,
  decimalsB,
}: {
  data: SwapResultShape;
  exitTokenMint: string | null;
  decimalsA: number;
  decimalsB: number;
}) {
  if (data.skipped) {
    return (
      <Card>
        <CardLabel>Exit swap · skipped</CardLabel>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {data.notes ?? "Nothing to swap."}
        </p>
      </Card>
    );
  }
  // Las cantidades del swap están en los decimales del fromMint/exitMint. Sin
  // saber cuál es cuál con certeza, usamos decimalsA como heurística — ambos
  // decimals suelen ser similares (SOL=9, USDC=6); el usuario ve raw + decimal
  // best-effort. F2 hará el lookup correcto.
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardLabel>Exit swap {data.dryRun ? "· dry-run" : ""}</CardLabel>
        {data.txId ? <SolscanLink sig={data.txId} /> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Field label="From mint">
          {data.fromMint ? truncateAddress(data.fromMint, 6, 6) : "—"}
        </Field>
        <Field label="To mint">
          {exitTokenMint ? truncateAddress(exitTokenMint, 6, 6) : "—"}
        </Field>
        <Field label="Input (raw)">{data.inputAmount ?? "—"}</Field>
        <Field label="Estimated output (raw)">
          {data.estimatedOutput ?? "—"}
        </Field>
        <Field label="Input (approx)">
          {data.inputAmount
            ? formatTokenAmount(data.inputAmount, decimalsA)
            : "—"}
        </Field>
        <Field label="Output (approx)">
          {data.estimatedOutput
            ? formatTokenAmount(data.estimatedOutput, decimalsB)
            : "—"}
        </Field>
      </div>
      {data.notes ? (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          {data.notes}
        </p>
      ) : null}
    </Card>
  );
}

// ============================================================================
// Small helpers
// ============================================================================

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-0.5 font-mono">{children}</div>
    </div>
  );
}

function DistanceCell({
  current,
  target,
  direction,
}: {
  current: number | null;
  target: number;
  direction: string;
}) {
  if (current === null) return <>—</>;
  const distancePct = ((target - current) / current) * 100;
  const sign = distancePct >= 0 ? "+" : "";
  const reached = direction === "above" ? current >= target : current <= target;
  return (
    <span className={reached ? "text-[var(--color-warning)]" : ""}>
      {sign}
      {distancePct.toFixed(2)}%{reached ? " · triggered" : ""}
    </span>
  );
}

function SolscanLink({ sig }: { sig: string }) {
  return (
    <Link
      href={`https://solscan.io/tx/${sig}?cluster=devnet`}
      target="_blank"
      className="text-xs text-[var(--color-accent)] hover:underline"
    >
      {truncateAddress(sig, 6, 6)} ↗
    </Link>
  );
}

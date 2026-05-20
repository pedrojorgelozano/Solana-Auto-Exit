"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { PageHeader } from "@/components/PageHeader";
import { FieldError } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { statusView, TONE_CLASSES, type BackendStatus } from "@/lib/status";
import {
  formatAmountWithSymbol,
  formatDistance,
  formatPollInterval,
  formatPrice,
  formatSlippage,
  truncateAddress,
} from "@/lib/format";
import { tokenSymbol } from "@/lib/tokens";

type TaskData = inferRouterOutputs<AppRouter>["tasks"]["get"];

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

interface ProtocolConfigShape {
  positionMint?: string;
  decimalsA?: number;
  decimalsB?: number;
}

export default function TaskPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const utils = trpc.useUtils();
  const task = trpc.tasks.get.useQuery({ id }, { refetchInterval: 2_000 });
  const refresh = () => utils.tasks.get.invalidate({ id });

  return (
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-12 fade-in">
      <PageHeader
        eyebrow="Watcher"
        title="Live status"
        back={{ href: "/tasks", label: "All tasks" }}
      />

      {task.isLoading ? (
        <p className="t-small text-[var(--color-text-muted)]">Loading…</p>
      ) : task.error ? (
        <p className="t-small text-[var(--color-danger)]">{task.error.message}</p>
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
  const view = statusView(task.status as BackendStatus);
  const tone = TONE_CLASSES[view.tone];

  const protocolConfig = task.protocolConfig as ProtocolConfigShape | null;
  const decimalsA = protocolConfig?.decimalsA ?? 9;
  const decimalsB = protocolConfig?.decimalsB ?? 6;
  // En el server no guardamos los mints A/B del pool por task; usamos heurística:
  // SOL para A, devUSDC para B. F2 puede mejorarlo si añadimos los mints al task row.
  const mintA = "So11111111111111111111111111111111111111112";
  const mintB = task.exitTokenMint ?? "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k";

  const distance = formatDistance(
    task.runtime.lastPrice,
    task.targetPrice,
    task.direction,
  );

  return (
    <div className="space-y-16">
      {/* === Hero === */}
      <section>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${tone.dot} ${
              view.pulsing ? "pulse-soft" : ""
            }`}
          />
          <span className={`t-eyebrow ${tone.text}`}>{view.label}</span>
          {task.dryRun ? (
            <span className="t-eyebrow text-[var(--color-warning)]">
              · simulation
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
          {view.description}
        </p>

        {/* Big number: current price */}
        <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-7">
            <div className="t-eyebrow text-[var(--color-text-muted)]">
              Current price
            </div>
            <div className="mt-3 t-num-display tabular-nums">
              {task.runtime.lastPrice !== null
                ? formatPrice(task.runtime.lastPrice, 6)
                : "—"}
            </div>
            <div className="mt-3 t-small text-[var(--color-text-muted)]">
              {task.runtime.lastTickAt
                ? `last tick ${new Date(task.runtime.lastTickAt).toLocaleTimeString()}`
                : "no ticks yet"}
            </div>
          </div>

          <div className="md:col-span-5 md:border-l md:border-[var(--color-hairline)] md:pl-10">
            <div className="t-eyebrow text-[var(--color-text-muted)]">Target</div>
            <div className="mt-3 t-num text-2xl text-[var(--color-text)]">
              {task.direction === "above" ? "≥ " : "≤ "}
              {formatPrice(task.targetPrice, 6)}
            </div>
            {distance.pct !== null ? (
              <div
                className={`mt-2 t-eyebrow ${
                  distance.reached
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {distance.text}
                {distance.reached ? " · trigger met" : " from current"}
              </div>
            ) : null}
          </div>
        </div>

        <Controls task={task} status={task.status as BackendStatus} refresh={refresh} />
      </section>

      {/* === Trigger details === */}
      <TriggerDetails task={task} />

      {/* === Last error === */}
      {task.lastError ? (
        <section className="border-l-2 border-[var(--color-danger)] pl-5">
          <div className="t-eyebrow text-[var(--color-danger)]">Last error</div>
          <p className="mt-2 break-words t-small text-[var(--color-text)]">
            {task.lastError}
          </p>
        </section>
      ) : null}

      {/* === Close result === */}
      {task.closeResult ? (
        <CloseReceipt
          data={task.closeResult as unknown as CloseResultShape}
          decimalsA={decimalsA}
          decimalsB={decimalsB}
          mintA={mintA}
          mintB={mintB}
        />
      ) : null}

      {/* === Swap result === */}
      {task.swapResult ? (
        <SwapReceipt
          data={task.swapResult as unknown as SwapResultShape}
          exitTokenMint={task.exitTokenMint}
          decimalsA={decimalsA}
          decimalsB={decimalsB}
        />
      ) : null}
    </div>
  );
}

// ============================================================================
// Controls
// ============================================================================

function Controls({
  task,
  status,
  refresh,
}: {
  task: TaskData;
  status: BackendStatus;
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
  const canStart =
    status === "paused" || status === "idle" || status === "error";

  return (
    <div className="mt-10 flex flex-wrap items-center justify-end gap-2 hairline-t pt-6">
      {canStart ? (
        <Button onClick={() => start.mutate({ id: task.id })} disabled={busy}>
          {status === "error" ? "Restart" : "Resume"}
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
        size="sm"
        onClick={() => {
          if (confirm("Delete this watcher? Its history goes with it.")) {
            del.mutate({ id: task.id });
          }
        }}
        disabled={busy}
      >
        Delete
      </Button>
      {err ? (
        <div className="basis-full">
          <FieldError>{err}</FieldError>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Trigger details strip
// ============================================================================

function TriggerDetails({ task }: { task: TaskData }) {
  return (
    <section className="hairline-t pt-8">
      <div className="t-eyebrow text-[var(--color-text-muted)]">Configuration</div>
      <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
        <Field label="Position">
          <span className="t-num text-[var(--color-text)]">
            {truncateAddress(task.positionId, 6, 6)}
          </span>
        </Field>
        <Field label="Direction">
          {task.direction === "above" ? "Take profit" : "Stop loss"}
        </Field>
        <Field label="Poll interval">{formatPollInterval(task.pollMs)}</Field>
        <Field label="Close slippage">{formatSlippage(task.slippageBps)}</Field>
        {task.exitTokenMint ? (
          <>
            <Field label="Exit token">{tokenSymbol(task.exitTokenMint)}</Field>
            <Field label="Exit slippage">
              {formatSlippage(task.exitSwapSlippageBps)}
            </Field>
          </>
        ) : null}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-eyebrow text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-2 t-body text-[var(--color-text)]">{children}</div>
    </div>
  );
}

// ============================================================================
// Receipts — close + swap como "recibo editorial"
// ============================================================================

function CloseReceipt({
  data,
  decimalsA,
  decimalsB,
  mintA,
  mintB,
}: {
  data: CloseResultShape;
  decimalsA: number;
  decimalsB: number;
  mintA: string;
  mintB: string;
}) {
  return (
    <section className="hairline-t pt-8">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="t-eyebrow text-[var(--color-positive)]">
            Position closed {data.dryRun ? "· simulated" : ""}
          </div>
          <h3 className="mt-2 t-h2">Recovered from pool</h3>
        </div>
        {data.txId ? <SolscanLink sig={data.txId} /> : null}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
        <Receipt label={`Received ${tokenSymbol(mintA)}`}>
          {formatAmountWithSymbol(data.estimatedTokenA, mintA, decimalsA, 6)}
        </Receipt>
        <Receipt label={`Received ${tokenSymbol(mintB)}`}>
          {formatAmountWithSymbol(data.estimatedTokenB, mintB, decimalsB, 6)}
        </Receipt>
        <Receipt label="Fees A">
          {formatAmountWithSymbol(data.feesTokenA, mintA, decimalsA, 6)}
        </Receipt>
        <Receipt label="Fees B">
          {formatAmountWithSymbol(data.feesTokenB, mintB, decimalsB, 6)}
        </Receipt>
      </dl>

      {data.notes ? (
        <p className="mt-6 t-small text-[var(--color-text-muted)]">{data.notes}</p>
      ) : null}
    </section>
  );
}

function SwapReceipt({
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
      <section className="hairline-t pt-8">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          Exit swap · skipped
        </div>
        <p className="mt-2 t-small text-[var(--color-text-muted)]">
          {data.notes ?? "Nothing to swap."}
        </p>
      </section>
    );
  }

  const fromSym = data.fromMint ? tokenSymbol(data.fromMint) : "?";
  const toSym = exitTokenMint ? tokenSymbol(exitTokenMint) : "?";
  // Aproximación: decimalsA si fromMint == mint A, decimalsB en otro caso.
  const isFromA =
    data.fromMint === "So11111111111111111111111111111111111111112";
  const fromDecimals = isFromA ? decimalsA : decimalsB;
  const toDecimals = isFromA ? decimalsB : decimalsA;

  return (
    <section className="hairline-t pt-8">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="t-eyebrow text-[var(--color-positive)]">
            Swapped {data.dryRun ? "· simulated" : ""}
          </div>
          <h3 className="mt-2 t-h2">
            {fromSym} <span className="text-[var(--color-text-muted)]">→</span>{" "}
            {toSym}
          </h3>
        </div>
        {data.txId ? <SolscanLink sig={data.txId} /> : null}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3">
        <Receipt label="Input">
          {data.inputAmount
            ? formatAmountWithSymbol(
                data.inputAmount,
                data.fromMint ?? "",
                fromDecimals,
                6,
              )
            : "—"}
        </Receipt>
        <Receipt label="Output (estimated)">
          {data.estimatedOutput
            ? formatAmountWithSymbol(
                data.estimatedOutput,
                exitTokenMint ?? "",
                toDecimals,
                6,
              )
            : "—"}
        </Receipt>
        <Receipt label="Output (minimum)">
          {data.minimumOutput
            ? formatAmountWithSymbol(
                data.minimumOutput,
                exitTokenMint ?? "",
                toDecimals,
                6,
              )
            : "—"}
        </Receipt>
      </dl>

      {data.notes ? (
        <p className="mt-6 t-small text-[var(--color-text-muted)]">{data.notes}</p>
      ) : null}
    </section>
  );
}

function Receipt({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="t-eyebrow text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-2 t-num text-lg text-[var(--color-text)]">{children}</dd>
    </div>
  );
}

function SolscanLink({ sig }: { sig: string }) {
  return (
    <Link
      href={`https://solscan.io/tx/${sig}?cluster=devnet`}
      target="_blank"
      rel="noopener noreferrer"
      className="t-eyebrow text-[var(--color-accent-bright)] hover:underline"
    >
      tx {truncateAddress(sig, 6, 6)} ↗
    </Link>
  );
}

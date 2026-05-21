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
  formatTimeAgo,
  formatTokenAmount,
  formatTriggers,
  truncateAddress,
} from "@/lib/format";
import { tokenSymbol, tokenMeta } from "@/lib/tokens";

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
  /** Mints A/B del pool. Persistido desde F2.4. Tasks anteriores no lo tienen. */
  tokenMintA?: string;
  tokenMintB?: string;
}

const SOL_MINT = "So11111111111111111111111111111111111111112";

export default function TaskPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const utils = trpc.useUtils();
  const task = trpc.tasks.get.useQuery({ id }, { refetchInterval: 2_000 });
  const refresh = () => utils.tasks.get.invalidate({ id });

  return (
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-12 fade-in">
      <PageHeader
        eyebrow="Auto-exit"
        title="Live status"
        back={{ href: "/tasks", label: "All auto-exits" }}
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
  // Desde F2.4 persistimos tokenMintA/tokenMintB en protocolConfig al crear el
  // task. Para tasks anteriores caemos a la heurística previa (SOL en A,
  // exitTokenMint o devUSDC en B).
  const mintA = protocolConfig?.tokenMintA ?? SOL_MINT;
  const mintB =
    protocolConfig?.tokenMintB ??
    task.exitTokenMint ??
    "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k";

  // History compartido entre los receipts (busca el verified) y el timeline.
  // TanStack Query deduplica las dos llamadas con la misma key.
  const history = trpc.tasks.history.useQuery(
    { id: task.id },
    { refetchInterval: 5_000 },
  );
  const closeShape = task.closeResult as CloseResultShape | null;
  const swapShape = task.swapResult as SwapResultShape | null;
  const verifiedClose = findVerifiedDeltas(
    history.data,
    "close",
    closeShape?.txId,
  );
  const verifiedSwap = findVerifiedDeltas(
    history.data,
    "swap",
    swapShape?.txId,
  );

  const tpDistance =
    task.takeProfitPrice !== null
      ? formatDistance(task.runtime.lastPrice, task.takeProfitPrice, "above")
      : null;
  const slDistance =
    task.stopLossPrice !== null
      ? formatDistance(task.runtime.lastPrice, task.stopLossPrice, "below")
      : null;

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

          <div className="md:col-span-5 md:border-l md:border-[var(--color-hairline)] md:pl-10 space-y-6">
            {task.takeProfitPrice !== null ? (
              <TriggerBlock
                kind="tp"
                price={task.takeProfitPrice}
                distance={tpDistance}
                triggered={task.triggeredBy === "take_profit"}
              />
            ) : null}
            {task.stopLossPrice !== null ? (
              <TriggerBlock
                kind="sl"
                price={task.stopLossPrice}
                distance={slDistance}
                triggered={task.triggeredBy === "stop_loss"}
              />
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
          verified={verifiedClose}
        />
      ) : null}

      {/* === Swap result === */}
      {task.swapResult ? (
        <SwapReceipt
          data={task.swapResult as unknown as SwapResultShape}
          exitTokenMint={task.exitTokenMint}
          mintA={mintA}
          decimalsA={decimalsA}
          decimalsB={decimalsB}
          verified={verifiedSwap}
        />
      ) : null}

      {/* === Activity timeline === */}
      <ActivityTimeline taskId={task.id} />
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
        <Field label="Triggers">
          {formatTriggers(task.takeProfitPrice, task.stopLossPrice, 4)}
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
// TriggerBlock — uno por trigger (TP/SL) en el hero del dashboard
// ============================================================================

function TriggerBlock({
  kind,
  price,
  distance,
  triggered,
}: {
  kind: "tp" | "sl";
  price: number;
  distance: ReturnType<typeof formatDistance> | null;
  triggered: boolean;
}) {
  const label = kind === "tp" ? "Take profit" : "Stop loss";
  const op = kind === "tp" ? "≥" : "≤";
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="t-eyebrow text-[var(--color-text-muted)]">{label}</span>
        {triggered ? (
          <span className="t-eyebrow text-[var(--color-warning)]">
            · fired this one
          </span>
        ) : null}
      </div>
      <div className="mt-1 t-num text-xl text-[var(--color-text)]">
        {op} {formatPrice(price, 6)}
      </div>
      {distance && distance.pct !== null ? (
        <div
          className={`mt-1 t-eyebrow ${
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
  verified,
}: {
  data: CloseResultShape;
  decimalsA: number;
  decimalsB: number;
  mintA: string;
  mintB: string;
  verified: VerifiedDeltas | null;
}) {
  // Para "Received": delta neto on-chain de cada mint. SOL nativo va por
  // solDelta; SPL por tokenDeltas[mint].
  const actualARaw = verified ? rawDeltaForMint(verified, mintA) : null;
  const actualBRaw = verified ? rawDeltaForMint(verified, mintB) : null;

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
          <ActualLine
            rawActual={actualARaw}
            rawQuoted={data.estimatedTokenA}
            decimals={decimalsA}
            mint={mintA}
            showDiff={mintA !== SOL_MINT}
          />
        </Receipt>
        <Receipt label={`Received ${tokenSymbol(mintB)}`}>
          {formatAmountWithSymbol(data.estimatedTokenB, mintB, decimalsB, 6)}
          <ActualLine
            rawActual={actualBRaw}
            rawQuoted={data.estimatedTokenB}
            decimals={decimalsB}
            mint={mintB}
            showDiff={mintB !== SOL_MINT}
          />
        </Receipt>
        <Receipt label="Fees A">
          {formatAmountWithSymbol(data.feesTokenA, mintA, decimalsA, 6)}
        </Receipt>
        <Receipt label="Fees B">
          {formatAmountWithSymbol(data.feesTokenB, mintB, decimalsB, 6)}
        </Receipt>
      </dl>

      {verified && mintA === SOL_MINT ? (
        <p className="mt-6 t-small text-[var(--color-text-dim)]">
          The actual SOL delta includes tx fees deducted and any rent recovered
          from closed accounts, which is why it can differ from the quoted
          liquidity amount.
        </p>
      ) : null}

      {data.notes ? (
        <p className="mt-6 t-small text-[var(--color-text-muted)]">{data.notes}</p>
      ) : null}
    </section>
  );
}

function SwapReceipt({
  data,
  exitTokenMint,
  mintA,
  decimalsA,
  decimalsB,
  verified,
}: {
  data: SwapResultShape;
  exitTokenMint: string | null;
  mintA: string;
  decimalsA: number;
  decimalsB: number;
  verified: VerifiedDeltas | null;
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
  // Comparamos fromMint con los mints reales del pool (persistidos desde F2.4
  // en protocolConfig; fallback heurístico en Dashboard si el task es viejo).
  const isFromA = data.fromMint === mintA;
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

      {(() => {
        // Cómputo de "actual" para input y output del swap. Para SOL como
        // input, aislamos el swap input restando la tx fee del solDelta.
        let actualInputRaw: string | null = null;
        let actualOutputRaw: string | null = null;
        if (verified && data.fromMint) {
          if (data.fromMint === SOL_MINT) {
            const fee = BigInt(verified.fee);
            const sol = BigInt(verified.solDelta);
            // solDelta es negativo cuando gastas SOL. -sol - fee = input puro.
            actualInputRaw = (-sol - fee).toString();
          } else {
            const tokenDelta = BigInt(
              verified.tokenDeltas[data.fromMint] ?? "0",
            );
            actualInputRaw = (-tokenDelta).toString();
          }
        }
        if (verified && exitTokenMint) {
          actualOutputRaw = rawDeltaForMint(verified, exitTokenMint);
        }
        return (
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
              <ActualLine
                rawActual={actualInputRaw}
                rawQuoted={data.inputAmount}
                decimals={fromDecimals}
                mint={data.fromMint ?? ""}
                showDiff
              />
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
              <ActualLine
                rawActual={actualOutputRaw}
                rawQuoted={data.estimatedOutput}
                decimals={toDecimals}
                mint={exitTokenMint ?? ""}
                showDiff
              />
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
        );
      })()}

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

// ============================================================================
// Verified deltas — payload del evento `verified` que emitimos en el backend
// ============================================================================

interface VerifiedDeltas {
  fee: string;
  solDelta: string;
  tokenDeltas: Record<string, string>;
}

function findVerifiedDeltas(
  events: HistoryEvent[] | undefined,
  kind: "close" | "swap",
  signature: string | undefined,
): VerifiedDeltas | null {
  if (!events || !signature) return null;
  for (const ev of events) {
    if (ev.event !== "verified") continue;
    const d = ev.data as Record<string, unknown> | null;
    if (!d) continue;
    if (d.kind === kind && d.signature === signature) {
      return {
        fee: String(d.fee ?? "0"),
        solDelta: String(d.solDelta ?? "0"),
        tokenDeltas: (d.tokenDeltas as Record<string, string>) ?? {},
      };
    }
  }
  return null;
}

/** Para un mint dado, devuelve el delta raw (string bigint). SOL nativo → solDelta. */
function rawDeltaForMint(verified: VerifiedDeltas, mint: string): string {
  if (mint === SOL_MINT) return verified.solDelta;
  return verified.tokenDeltas[mint] ?? "0";
}

/**
 * Línea pequeña debajo de cada cell de un receipt con el delta real on-chain.
 * Opcionalmente computa el diff % vs el quoted. Para SOL no mostramos diff
 * porque incluye tx fees y rent recovery — sería visualmente alarmante.
 */
function ActualLine({
  rawActual,
  rawQuoted,
  decimals,
  mint,
  showDiff = false,
}: {
  rawActual: string | null;
  rawQuoted: string | undefined;
  decimals: number;
  mint: string;
  showDiff?: boolean;
}) {
  if (rawActual === null || rawActual === "0") return null;
  const sign = rawActual.startsWith("-") ? "" : "+";
  const display = `${sign}${formatTokenAmount(rawActual, decimals, 6)} ${tokenSymbol(mint)}`;
  const diff = showDiff ? computeDiffPct(rawActual, rawQuoted) : null;
  return (
    <div className="mt-1 t-eyebrow text-[var(--color-text-dim)]">
      actual {display}
      {diff !== null ? (
        <span
          className={`ml-2 ${
            Math.abs(diff.value) < 0.01
              ? "text-[var(--color-text-dim)]"
              : "text-[var(--color-warning)]"
          }`}
        >
          ({diff.label})
        </span>
      ) : null}
    </div>
  );
}

function computeDiffPct(
  actualRaw: string,
  quotedRaw: string | undefined,
): { label: string; value: number } | null {
  if (!quotedRaw) return null;
  try {
    const actual = BigInt(actualRaw);
    const quoted = BigInt(quotedRaw);
    if (quoted === 0n) return null;
    const diff = actual - quoted;
    const absQ = quoted < 0n ? -quoted : quoted;
    // bps * 100 = pct con 2 decimales
    const tenThou = (diff * 10_000n) / absQ;
    const value = Number(tenThou) / 100;
    if (!Number.isFinite(value)) return null;
    const sign = value > 0 ? "+" : "";
    return { label: `${sign}${value.toFixed(2)}%`, value };
  } catch {
    return null;
  }
}

// ============================================================================
// Activity timeline — eventos del task ordenados de más reciente a más antiguo
// ============================================================================

type HistoryEvent = inferRouterOutputs<AppRouter>["tasks"]["history"][number];

function ActivityTimeline({ taskId }: { taskId: string }) {
  const history = trpc.tasks.history.useQuery(
    { id: taskId },
    { refetchInterval: 5_000 },
  );

  if (history.isLoading) {
    return (
      <section className="hairline-t pt-8">
        <div className="t-eyebrow text-[var(--color-text-muted)]">Activity</div>
        <p className="mt-4 t-small text-[var(--color-text-dim)]">Loading…</p>
      </section>
    );
  }

  const events = history.data ?? [];
  if (events.length === 0) return null;

  return (
    <section className="hairline-t pt-8">
      <div className="flex items-baseline justify-between">
        <div className="t-eyebrow text-[var(--color-text-muted)]">Activity</div>
        <span className="t-eyebrow text-[var(--color-text-dim)]">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </div>
      <ol className="mt-6 divide-y divide-[var(--color-hairline)]">
        {events.map((ev) => (
          <EventRow key={ev.id} ev={ev} />
        ))}
      </ol>
    </section>
  );
}

function EventRow({ ev }: { ev: HistoryEvent }) {
  const desc = describeEvent(ev);
  const timestamp =
    typeof ev.timestamp === "string"
      ? new Date(ev.timestamp).getTime()
      : new Date(ev.timestamp as unknown as string | number).getTime();

  return (
    <li className="grid grid-cols-12 items-baseline gap-4 py-4">
      <div className="col-span-4 md:col-span-2 t-num text-[var(--color-text-muted)]">
        {formatTimeAgo(timestamp)}
      </div>
      <div className="col-span-8 md:col-span-2">
        <span className={`t-eyebrow ${desc.tone}`}>{desc.label}</span>
      </div>
      <div className="col-span-12 md:col-span-8 t-small text-[var(--color-text-muted)]">
        {desc.description}
        {desc.txId ? (
          <span className="ml-3">
            <SolscanLink sig={desc.txId} />
          </span>
        ) : null}
      </div>
    </li>
  );
}

function describeEvent(ev: HistoryEvent): {
  tone: string;
  label: string;
  description: React.ReactNode;
  txId?: string;
} {
  const data = (ev.data as Record<string, unknown> | null) ?? {};

  switch (ev.event) {
    case "created": {
      const protocol = typeof data.protocol === "string" ? data.protocol : null;
      const positionId =
        typeof data.positionId === "string" ? data.positionId : null;
      return {
        tone: "text-[var(--color-text-muted)]",
        label: "Created",
        description:
          protocol && positionId
            ? `Auto-exit created on ${protocol} for ${truncateAddress(positionId, 4, 4)}.`
            : "Auto-exit created.",
      };
    }
    case "started":
      return {
        tone: "text-[var(--color-positive)]",
        label: "Started",
        description: "Watching the pool price.",
      };
    case "resumed":
      return {
        tone: "text-[var(--color-positive)]",
        label: "Resumed",
        description: "Watcher resumed after a pause.",
      };
    case "paused": {
      const reason = typeof data.reason === "string" ? data.reason : "user";
      const msg =
        reason === "user"
          ? "Paused by user."
          : reason === "vault-locked"
            ? "Paused — the vault was locked while the watcher was running."
            : reason === "server-restart"
              ? "Paused at boot — vault was locked after the server restarted."
              : `Paused (${reason}).`;
      return {
        tone: "text-[var(--color-warning)]",
        label: "Paused",
        description: msg,
      };
    }
    case "stopped":
      return {
        tone: "text-[var(--color-text-muted)]",
        label: "Stopped",
        description: "Stopped manually. No further ticks.",
      };
    case "triggered": {
      const tb =
        data.triggeredBy === "stop_loss" ? "Stop-loss" : "Take-profit";
      return {
        tone: "text-[var(--color-warning)]",
        label: "Triggered",
        description: `${tb} threshold crossed — preparing to close.`,
      };
    }
    case "closed": {
      const dryRun = Boolean(data.dryRun);
      const txId = typeof data.txId === "string" ? data.txId : undefined;
      return {
        tone: "text-[var(--color-positive)]",
        label: "Closed",
        description: dryRun
          ? "Position closed in simulation — no transaction sent."
          : "Position closed on-chain.",
        txId,
      };
    }
    case "swapped": {
      const dryRun = Boolean(data.dryRun);
      const skipped = Boolean(data.skipped);
      const txId = typeof data.txId === "string" ? data.txId : undefined;
      const notes = typeof data.notes === "string" ? data.notes : null;
      return {
        tone: "text-[var(--color-positive)]",
        label: "Swapped",
        description: skipped
          ? `Exit swap skipped${notes ? ` — ${notes}` : "."}`
          : dryRun
            ? "Swap quoted in simulation — no transaction sent."
            : "Proceeds swapped on-chain.",
        txId,
      };
    }
    case "verified": {
      const kind = typeof data.kind === "string" ? data.kind : "";
      const sig = typeof data.signature === "string" ? data.signature : undefined;
      const solDelta =
        typeof data.solDelta === "string" ? BigInt(data.solDelta) : 0n;
      const rawDeltas = (data.tokenDeltas ?? {}) as Record<string, string>;
      const parts: string[] = [];
      for (const [mint, rawStr] of Object.entries(rawDeltas)) {
        const meta = tokenMeta(mint);
        const decimals = meta?.decimals ?? 0;
        const sign = rawStr.startsWith("-") ? "" : "+";
        parts.push(
          `${sign}${formatTokenAmount(rawStr, decimals, 6)} ${tokenSymbol(mint)}`,
        );
      }
      if (solDelta !== 0n) {
        const sign = solDelta < 0n ? "" : "+";
        parts.push(`${sign}${formatTokenAmount(solDelta.toString(), 9, 6)} SOL`);
      }
      return {
        tone: "text-[var(--color-positive)]",
        label: kind === "swap" ? "Swap verified" : "Close verified",
        description:
          parts.length > 0
            ? `On-chain delta: ${parts.join(" · ")}`
            : "On-chain queried — no balance changes detected.",
        txId: sig,
      };
    }
    case "error": {
      const message =
        typeof data.message === "string" ? data.message : "Unknown error.";
      return {
        tone: "text-[var(--color-danger)]",
        label: "Error",
        description: message,
      };
    }
    default:
      return {
        tone: "text-[var(--color-text-muted)]",
        label: ev.event,
        description: Object.keys(data).length
          ? JSON.stringify(data)
          : "",
      };
  }
}

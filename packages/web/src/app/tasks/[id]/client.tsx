"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
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
  formatBuffer,
  formatBufferRemaining,
  formatDistance,
  formatPollInterval,
  formatPrice,
  formatRangeStatus,
  formatSlippage,
  formatTaskPair,
  formatTimeAgo,
  formatTokenAmount,
  formatTriggers,
  truncateAddress,
} from "@/lib/format";
import { tokenSymbol, tokenMeta } from "@/lib/tokens";
import { useT } from "@/i18n/context";

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
  const { t } = useT();

  return (
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-12 fade-in">
      <PageHeader
        eyebrow={t.taskDetail.pageEyebrow}
        title={t.taskDetail.pageTitle}
        back={{ href: "/tasks", label: t.taskDetail.backLabel }}
      />

      {task.isLoading ? (
        <p className="t-small text-[var(--color-text-muted)]">
          {t.common.loading}
        </p>
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
  const { t } = useT();
  const view = statusView(task.status as BackendStatus);
  const tone = TONE_CLASSES[view.tone];
  const statusKey = task.status as BackendStatus;
  const statusLabel = t.status[statusKey]?.label ?? task.status;
  const statusDescription = t.status[statusKey]?.description ?? "";

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
          <span className={`t-eyebrow ${tone.text}`}>{statusLabel}</span>
          {task.dryRun ? (
            <span className="t-eyebrow text-[var(--color-warning)]">
              {t.format.simulation}
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
          {statusDescription}
        </p>

        {/* Big number: current price */}
        <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-7">
            <div className="t-eyebrow text-[var(--color-text-muted)]">
              {t.taskDetail.hero.currentPrice}
            </div>
            <div className="mt-3 t-num-display tabular-nums">
              {task.runtime.lastPrice !== null
                ? formatPrice(task.runtime.lastPrice, 6)
                : "—"}
            </div>
            <div className="mt-3 t-small text-[var(--color-text-muted)]">
              {task.runtime.lastTickAt
                ? t.taskDetail.hero.lastTick(
                    new Date(task.runtime.lastTickAt).toLocaleTimeString(),
                  )
                : t.taskDetail.hero.noTicks}
            </div>
          </div>

          <div className="md:col-span-5 md:border-l md:border-[var(--color-hairline)] md:pl-10 space-y-6">
            {task.takeProfitPrice !== null ? (
              <TriggerBlock
                kind="tp"
                price={task.takeProfitPrice}
                distance={tpDistance}
                triggered={task.triggeredBy === "take_profit"}
                bufferMs={task.takeProfitBufferMs}
                firstCrossedAt={task.runtime.tpFirstCrossedAt}
              />
            ) : null}
            {task.stopLossPrice !== null ? (
              <TriggerBlock
                kind="sl"
                price={task.stopLossPrice}
                distance={slDistance}
                triggered={task.triggeredBy === "stop_loss"}
                bufferMs={task.stopLossBufferMs}
                firstCrossedAt={task.runtime.slFirstCrossedAt}
              />
            ) : null}
          </div>
        </div>

        <Controls task={task} status={task.status as BackendStatus} refresh={refresh} />
      </section>

      {/* === Pool state (live) === */}
      <PoolState task={task} />

      {/* === Trigger details === */}
      <TriggerDetails task={task} />

      {/* === Error + Recovery panel — solo en status error con mensaje === */}
      {task.status === "error" && task.lastError ? (
        <ErrorRecovery
          taskId={task.id}
          positionId={task.positionId}
          message={task.lastError}
          slippageBps={task.slippageBps}
          triggered={task.triggeredAt !== null}
          refresh={refresh}
        />
      ) : task.lastError ? (
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
          network={task.network}
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
          network={task.network}
        />
      ) : null}

      {/* === Activity timeline === */}
      <ActivityTimeline taskId={task.id} network={task.network} />
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
  const { t } = useT();
  const c = t.taskDetail.controls;
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
          {status === "error" ? c.restart : c.resume}
        </Button>
      ) : null}
      {isActive ? (
        <Button
          variant="secondary"
          onClick={() => pause.mutate({ id: task.id })}
          disabled={busy}
        >
          {c.pause}
        </Button>
      ) : null}
      {/* F6.3: Stop oculto en UI. El estado `stopped` se mantiene en el
          backend (enum, tRPC mutation, manager) para que tasks históricas
          renderizen bien. Para re-exponer, descomenta el bloque siguiente:

      {status !== "done" && status !== "stopped" ? (
        <Button
          variant="secondary"
          onClick={() => stop.mutate({ id: task.id })}
          disabled={busy}
        >
          Stop
        </Button>
      ) : null}
      */}
      <Button
        variant="danger"
        size="sm"
        onClick={async () => {
          if (await confirm(c.deleteConfirm)) {
            del.mutate({ id: task.id });
          }
        }}
        disabled={busy}
      >
        {c.delete}
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
// Pool state — range, in/out, holdings, fees pending. Read-only en vivo desde
// el RPC. Se renderiza si la bot wallet aún posee la posición; si la NFT ya
// se cerró o se transfirió, listOwned no la encuentra y la sección desaparece.
// ============================================================================

function PoolState({ task }: { task: TaskData }) {
  const { t } = useT();
  const p = t.taskDetail.pool;
  const walletStatus = trpc.wallet.status.useQuery();
  const owner = walletStatus.data?.address;

  // listOwned (igual que /positions y home) para resolver el `ref` completo
  // con su poolId — necesario para getSummary. Sin owner no podemos pedirlo.
  const list = trpc.positions.listOwned.useQuery(
    {
      protocol: task.protocol,
      network: task.network,
      rpcUrl: task.rpcUrl,
      owner: owner ?? "",
    },
    { enabled: !!owner },
  );

  const ref = list.data?.find((r) => r.id === task.positionId);

  const summary = trpc.positions.getSummary.useQuery(
    {
      protocol: task.protocol,
      network: task.network,
      rpcUrl: task.rpcUrl,
      ref: ref ?? { protocol: "", id: "", label: "", poolId: "" },
    },
    { enabled: !!ref, refetchInterval: 10_000 },
  );

  // Si no hay owner, la wallet no se ha cargado todavía → escondemos sin
  // pintar nada. Si listOwned o getSummary fallan, mismo enfoque: no aporta
  // valor mostrar errores aquí; el resto de la página sigue funcionando.
  if (!owner || !ref || !summary.data) return null;

  const s = summary.data;
  const symA = tokenSymbol(s.tokenA.mint);
  const symB = tokenSymbol(s.tokenB.mint);

  return (
    <section className="hairline-t pt-8">
      <div className="t-eyebrow text-[var(--color-text-muted)]">{p.eyebrow}</div>
      <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
        {/* Range con bg tintado para que el estado in/out salte a la vista. */}
        <div
          className={`rounded-lg border-l-2 px-4 py-3 ${
            s.isInRange
              ? "bg-[var(--color-positive-bg)] border-[var(--color-positive)]"
              : "bg-[var(--color-danger-bg)] border-[var(--color-danger)]"
          }`}
        >
          <div className="t-eyebrow text-[var(--color-text-muted)]">{p.range}</div>
          <div className="mt-2 text-[var(--color-text)]">
            <span className="t-num">
              {formatPrice(s.range.min, 2)} – {formatPrice(s.range.max, 2)}
            </span>
            <div
              className={`mt-1 t-eyebrow ${
                s.isInRange
                  ? "text-[var(--color-positive)]"
                  : "text-[var(--color-danger)]"
              }`}
            >
              {formatRangeStatus(s.isInRange, t)}
            </div>
          </div>
        </div>
        <Field label={p.holdings(symA)}>
          <span className="t-num">
            {formatTokenAmount(s.liquidity.tokenA, s.tokenA.decimals, 6)}
          </span>
        </Field>
        <Field label={p.holdings(symB)}>
          <span className="t-num">
            {formatTokenAmount(s.liquidity.tokenB, s.tokenB.decimals, 6)}
          </span>
        </Field>
        <Field label={p.feesPending}>
          {s.feesPending ? (
            <div className="t-num text-[var(--color-text-muted)]">
              <div>
                {formatTokenAmount(
                  s.feesPending.tokenA,
                  s.tokenA.decimals,
                  6,
                )}{" "}
                {symA}
              </div>
              <div>
                {formatTokenAmount(
                  s.feesPending.tokenB,
                  s.tokenB.decimals,
                  6,
                )}{" "}
                {symB}
              </div>
            </div>
          ) : (
            <span className="t-num text-[var(--color-text-muted)]">—</span>
          )}
        </Field>
      </div>
    </section>
  );
}

// ============================================================================
// Trigger details strip
// ============================================================================

function TriggerDetails({ task }: { task: TaskData }) {
  const { t } = useT();
  const cfg = t.taskDetail.config;
  const hasBuffer =
    (task.takeProfitBufferMs && task.takeProfitBufferMs > 0) ||
    (task.stopLossBufferMs && task.stopLossBufferMs > 0);
  const pair = formatTaskPair(task.protocolConfig);
  return (
    <section className="hairline-t pt-8">
      <div className="t-eyebrow text-[var(--color-text-muted)]">{cfg.eyebrow}</div>
      <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
        <Field label={cfg.position}>
          {pair ? (
            <>
              <span className="text-[var(--color-text)]">{pair}</span>
              <span className="ml-2 t-eyebrow text-[var(--color-text-dim)]">
                {task.protocol}
              </span>
            </>
          ) : (
            <span className="t-num text-[var(--color-text)]">
              {truncateAddress(task.positionId, 6, 6)}
            </span>
          )}
        </Field>
        <Field label={cfg.triggers}>
          {formatTriggers(task.takeProfitPrice, task.stopLossPrice, 4)}
        </Field>
        <Field label={cfg.pollInterval}>{formatPollInterval(task.pollMs)}</Field>
        <Field label={cfg.closeSlippage}>{formatSlippage(task.slippageBps)}</Field>
        {hasBuffer ? (
          <Field label={cfg.timeBuffer}>
            <span className="t-num">
              {task.takeProfitPrice !== null
                ? `TP ${formatBuffer(task.takeProfitBufferMs, t)}`
                : null}
              {task.takeProfitPrice !== null && task.stopLossPrice !== null
                ? " · "
                : null}
              {task.stopLossPrice !== null
                ? `SL ${formatBuffer(task.stopLossBufferMs, t)}`
                : null}
            </span>
          </Field>
        ) : null}
        {task.exitTokenMint ? (
          <>
            <Field label={cfg.exitToken}>{tokenSymbol(task.exitTokenMint)}</Field>
            <Field label={cfg.exitSlippage}>
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
  bufferMs,
  firstCrossedAt,
}: {
  kind: "tp" | "sl";
  price: number;
  distance: ReturnType<typeof formatDistance> | null;
  triggered: boolean;
  bufferMs: number | null;
  firstCrossedAt: number | null;
}) {
  const { t } = useT();
  const tb = t.taskDetail.triggerBlock;
  const label = kind === "tp" ? tb.tp : tb.sl;
  const op = kind === "tp" ? "≥" : "≤";
  const remaining = formatBufferRemaining(
    firstCrossedAt,
    bufferMs,
    Date.now(),
    t,
  );
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="t-eyebrow text-[var(--color-text-muted)]">{label}</span>
        {triggered ? (
          <span className="t-eyebrow text-[var(--color-warning)]">
            {tb.firedThisOne}
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
          {distance.reached ? tb.triggerMet : tb.awayFromCurrent}
        </div>
      ) : null}
      {bufferMs && bufferMs > 0 ? (
        <div className="mt-1 t-eyebrow text-[var(--color-text-dim)]">
          {tb.bufferLabel(formatBuffer(bufferMs, t))}
          {remaining ? (
            <span
              className={`ml-2 ${
                remaining === t.format.bufferMet
                  ? "text-[var(--color-warning)]"
                  : "text-[var(--color-accent-bright)]"
              }`}
            >
              · {remaining}
            </span>
          ) : null}
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
  network,
}: {
  data: CloseResultShape;
  decimalsA: number;
  decimalsB: number;
  mintA: string;
  mintB: string;
  verified: VerifiedDeltas | null;
  network: string;
}) {
  const { t } = useT();
  const r = t.taskDetail.receipt;
  // Para "Received": delta neto on-chain de cada mint. SOL nativo va por
  // solDelta; SPL por tokenDeltas[mint].
  const actualARaw = verified ? rawDeltaForMint(verified, mintA) : null;
  const actualBRaw = verified ? rawDeltaForMint(verified, mintB) : null;

  return (
    <section className="hairline-t pt-8">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="t-eyebrow text-[var(--color-positive)]">
            {r.closedHeader}
            {data.dryRun ? r.closedSimulated : ""}
          </div>
          <h3 className="mt-2 t-h2">{r.recoveredTitle}</h3>
        </div>
        {data.txId ? <SolscanLink sig={data.txId} network={network} /> : null}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
        <Receipt label={r.receivedLabel(tokenSymbol(mintA))}>
          {formatAmountWithSymbol(data.estimatedTokenA, mintA, decimalsA, 6)}
          <ActualLine
            rawActual={actualARaw}
            rawQuoted={data.estimatedTokenA}
            decimals={decimalsA}
            mint={mintA}
            showDiff={mintA !== SOL_MINT}
          />
        </Receipt>
        <Receipt label={r.receivedLabel(tokenSymbol(mintB))}>
          {formatAmountWithSymbol(data.estimatedTokenB, mintB, decimalsB, 6)}
          <ActualLine
            rawActual={actualBRaw}
            rawQuoted={data.estimatedTokenB}
            decimals={decimalsB}
            mint={mintB}
            showDiff={mintB !== SOL_MINT}
          />
        </Receipt>
        <Receipt label={r.feesA}>
          {formatAmountWithSymbol(data.feesTokenA, mintA, decimalsA, 6)}
        </Receipt>
        <Receipt label={r.feesB}>
          {formatAmountWithSymbol(data.feesTokenB, mintB, decimalsB, 6)}
        </Receipt>
      </dl>

      {verified && mintA === SOL_MINT ? (
        <p className="mt-6 t-small text-[var(--color-text-dim)]">
          {r.solDeltaNote}
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
  network,
}: {
  data: SwapResultShape;
  exitTokenMint: string | null;
  mintA: string;
  decimalsA: number;
  decimalsB: number;
  verified: VerifiedDeltas | null;
  network: string;
}) {
  const { t } = useT();
  const sw = t.taskDetail.swap;
  if (data.skipped) {
    return (
      <section className="hairline-t pt-8">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          {sw.skippedTitle}
        </div>
        <p className="mt-2 t-small text-[var(--color-text-muted)]">
          {data.notes ?? sw.skippedFallback}
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
            {sw.header}
            {data.dryRun ? sw.simulated : ""}
          </div>
          <h3 className="mt-2 t-h2">
            {fromSym} <span className="text-[var(--color-text-muted)]">→</span>{" "}
            {toSym}
          </h3>
        </div>
        {data.txId ? <SolscanLink sig={data.txId} network={network} /> : null}
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
            <Receipt label={sw.input}>
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
            <Receipt label={sw.outputEstimated}>
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
            <Receipt label={sw.outputMinimum}>
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

function SolscanLink({ sig, network }: { sig: string; network: string }) {
  const cluster = network === "mainnet" ? "" : "?cluster=devnet";
  return (
    <Link
      href={`https://solscan.io/tx/${sig}${cluster}`}
      target="_blank"
      rel="noopener noreferrer"
      className="t-eyebrow text-[var(--color-accent-bright)] hover:underline"
    >
      tx {truncateAddress(sig, 6, 6)} ↗
    </Link>
  );
}
// Nota: "tx" + signature truncada se mantiene en ambos idiomas — abreviatura
// universal en blockchain. No requiere traducción.

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
  const { t } = useT();
  if (rawActual === null || rawActual === "0") return null;
  const sign = rawActual.startsWith("-") ? "" : "+";
  const display = `${sign}${formatTokenAmount(rawActual, decimals, 6)} ${tokenSymbol(mint)}`;
  const diff = showDiff ? computeDiffPct(rawActual, rawQuoted) : null;
  return (
    <div className="mt-1 t-eyebrow text-[var(--color-text-dim)]">
      {t.taskDetail.receipt.actual}
      {display}
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
// Error recovery panel — diagnostica el error y guía la salida (delete +
// recrea con más slippage, o restart si parece transitorio). Ver docs/auto-exit.
// ============================================================================

function isSlippageError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("slippage") ||
    m.includes("tolerance") ||
    m.includes("price impact") ||
    // Orca whirlpool slippage error code (anchor):
    m.includes("0x1782")
  );
}

function ErrorRecovery({
  taskId,
  positionId,
  message,
  slippageBps,
  triggered,
  refresh,
}: {
  taskId: string;
  positionId: string;
  message: string;
  slippageBps: number;
  triggered: boolean;
  refresh: () => void;
}) {
  const { t } = useT();
  const e = t.taskDetail.error;
  const router = useRouter();
  const del = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      refresh();
      router.push(`/positions/${positionId}`);
    },
  });
  const [confirming, setConfirming] = useState(false);

  const slippage = isSlippageError(message);
  const closeAttempted = triggered;
  const slippagePctStr = `${(slippageBps / 100).toFixed(slippageBps % 100 === 0 ? 0 : 2)}%`;

  return (
    <section className="border-l-2 border-[var(--color-danger)] pl-5">
      <div className="t-eyebrow text-[var(--color-danger)]">
        {e.header}
        {slippage ? (
          <span className="ml-2 text-[var(--color-text-muted)]">
            {e.diagnosedSlippage}
          </span>
        ) : null}
      </div>
      <p className="mt-3 t-body text-[var(--color-text)] break-words">
        {message}
      </p>

      {slippage ? (
        <div className="mt-6 t-body text-[var(--color-text-muted)] space-y-3 max-w-2xl">
          <p>{e.slippageExplain(slippagePctStr)}</p>
          <p>
            <strong className="text-[var(--color-text)]">
              {e.positionIntact}
            </strong>
            {e.positionIntactCopy}
          </p>
          <p>
            <strong className="text-[var(--color-text)]">{e.recommended}</strong>
            {e.recommendedCopy}
            <strong className="text-[var(--color-text)]">2%</strong>
            {e.recommendedNormal}
            <strong className="text-[var(--color-text)]">5%</strong>
            {e.recommendedVolatile}
          </p>
        </div>
      ) : (
        <div className="mt-6 t-body text-[var(--color-text-muted)] space-y-3 max-w-2xl">
          <p>
            {e.nonSlippage}
            {closeAttempted ? (
              <>
                {e.closeAttemptedYes}
                <strong className="text-[var(--color-text)]">
                  {e.yourPositionIntact}
                </strong>
                {e.noTokensMoved}
              </>
            ) : (
              <>{e.closeAttemptedNo}</>
            )}
          </p>
          <p>
            {e.restartLine1}
            <strong className="text-[var(--color-text)]">{e.restartButton}</strong>
            {e.restartLine2}
            <Link
              href="/docs/auto-exit#when-the-close-fails"
              className="text-[var(--color-accent-bright)] hover:underline"
            >
              {e.troubleshootingGuide}
            </Link>
          </p>
        </div>
      )}

      {confirming ? (
        <div className="mt-8 flex flex-wrap items-center justify-end gap-3 hairline-t pt-6">
          <span className="t-small text-[var(--color-danger)] mr-auto">
            {e.deleteConfirm}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
            disabled={del.isPending}
          >
            {e.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={() => del.mutate({ id: taskId })}
            disabled={del.isPending}
          >
            {del.isPending ? t.common.deleting : e.deleteAndGo}
          </Button>
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap items-center justify-end gap-3 hairline-t pt-6">
          {slippage ? (
            <Link
              href={`/positions/${positionId}`}
              className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {e.setUpNew}
            </Link>
          ) : null}
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirming(true)}
          >
            {e.deleteCta}
          </Button>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Activity timeline — eventos del task ordenados de más reciente a más antiguo
// ============================================================================

type HistoryEvent = inferRouterOutputs<AppRouter>["tasks"]["history"][number];

function ActivityTimeline({
  taskId,
  network,
}: {
  taskId: string;
  network: string;
}) {
  const { t } = useT();
  const tl = t.taskDetail.timeline;
  const history = trpc.tasks.history.useQuery(
    { id: taskId },
    { refetchInterval: 5_000 },
  );

  if (history.isLoading) {
    return (
      <section className="hairline-t pt-8">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          {tl.eyebrow}
        </div>
        <p className="mt-4 t-small text-[var(--color-text-dim)]">
          {t.common.loading}
        </p>
      </section>
    );
  }

  const events = history.data ?? [];
  if (events.length === 0) return null;

  return (
    <section className="hairline-t pt-8">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <div className="t-eyebrow text-[var(--color-text-muted)]">
            {tl.eyebrow}
          </div>
          <Link
            href="/docs/operational#timeline"
            className="t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors"
          >
            {tl.whatsInHere}
          </Link>
        </div>
        <span className="t-eyebrow text-[var(--color-text-dim)]">
          {tl.events(events.length)}
        </span>
      </div>
      <ol className="mt-6 divide-y divide-[var(--color-hairline)]">
        {events.map((ev) => (
          <EventRow key={ev.id} ev={ev} network={network} />
        ))}
      </ol>
    </section>
  );
}

function EventRow({ ev, network }: { ev: HistoryEvent; network: string }) {
  const { t } = useT();
  const desc = describeEvent(ev, t);
  const timestamp =
    typeof ev.timestamp === "string"
      ? new Date(ev.timestamp).getTime()
      : new Date(ev.timestamp as unknown as string | number).getTime();

  return (
    <li className="grid grid-cols-12 items-baseline gap-4 py-4">
      <div className="col-span-4 md:col-span-2 t-num text-[var(--color-text-muted)]">
        {formatTimeAgo(timestamp, t)}
      </div>
      <div className="col-span-8 md:col-span-2">
        <span className={`t-eyebrow ${desc.tone}`}>{desc.label}</span>
      </div>
      <div className="col-span-12 md:col-span-8 t-small text-[var(--color-text-muted)]">
        {desc.description}
        {desc.txId ? (
          <span className="ml-3">
            <SolscanLink sig={desc.txId} network={network} />
          </span>
        ) : null}
      </div>
    </li>
  );
}

function describeEvent(
  ev: HistoryEvent,
  t: ReturnType<typeof useT>["t"],
): {
  tone: string;
  label: string;
  description: React.ReactNode;
  txId?: string;
} {
  const data = (ev.data as Record<string, unknown> | null) ?? {};
  const tl = t.taskDetail.timeline;
  const triggerKindTp = "Take-profit";
  const triggerKindSl = "Stop-loss";

  switch (ev.event) {
    case "created": {
      const protocol = typeof data.protocol === "string" ? data.protocol : null;
      const positionId =
        typeof data.positionId === "string" ? data.positionId : null;
      return {
        tone: "text-[var(--color-text-muted)]",
        label: tl.labels.created,
        description:
          protocol && positionId
            ? tl.descriptions.createdWith(
                protocol,
                truncateAddress(positionId, 4, 4),
              )
            : tl.descriptions.createdGeneric,
      };
    }
    case "started":
      return {
        tone: "text-[var(--color-positive)]",
        label: tl.labels.started,
        description: tl.descriptions.started,
      };
    case "resumed":
      return {
        tone: "text-[var(--color-positive)]",
        label: tl.labels.resumed,
        description: tl.descriptions.resumed,
      };
    case "paused": {
      const reason = typeof data.reason === "string" ? data.reason : "user";
      const msg =
        reason === "user"
          ? tl.descriptions.pausedUser
          : reason === "vault-locked"
            ? tl.descriptions.pausedVaultLocked
            : reason === "server-restart"
              ? tl.descriptions.pausedServerRestart
              : tl.descriptions.pausedOther(reason);
      return {
        tone: "text-[var(--color-warning)]",
        label: tl.labels.paused,
        description: msg,
      };
    }
    case "stopped":
      return {
        tone: "text-[var(--color-text-muted)]",
        label: tl.labels.stopped,
        description: tl.descriptions.stopped,
      };
    case "triggered": {
      const tb =
        data.triggeredBy === "stop_loss" ? triggerKindSl : triggerKindTp;
      return {
        tone: "text-[var(--color-warning)]",
        label: tl.labels.triggered,
        description: tl.descriptions.triggered(tb),
      };
    }
    case "buffer_armed": {
      const isSl = data.kind === "stop_loss";
      const bufMs =
        typeof data.bufferMs === "number" ? data.bufferMs : null;
      const duration = bufMs ? formatBuffer(bufMs, t) : "";
      return {
        tone: "text-[var(--color-accent-bright)]",
        label: tl.labels.bufferStarted,
        description: isSl
          ? tl.descriptions.bufferArmedSl(duration)
          : tl.descriptions.bufferArmedTp(duration),
      };
    }
    case "buffer_reset": {
      const isSl = data.kind === "stop_loss";
      return {
        tone: "text-[var(--color-text-muted)]",
        label: tl.labels.bufferReset,
        description: isSl
          ? tl.descriptions.bufferResetSl
          : tl.descriptions.bufferResetTp,
      };
    }
    case "closed": {
      const dryRun = Boolean(data.dryRun);
      const txId = typeof data.txId === "string" ? data.txId : undefined;
      return {
        tone: "text-[var(--color-positive)]",
        label: tl.labels.closed,
        description: dryRun
          ? tl.descriptions.closedDry
          : tl.descriptions.closedReal,
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
        label: tl.labels.swapped,
        description: skipped
          ? tl.descriptions.swapSkipped(notes)
          : dryRun
            ? tl.descriptions.swapDry
            : tl.descriptions.swapReal,
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
        label: kind === "swap" ? tl.labels.verifiedSwap : tl.labels.verifiedClose,
        description:
          parts.length > 0
            ? tl.descriptions.verifiedDeltas(parts.join(" · "))
            : tl.descriptions.verifiedNoChanges,
        txId: sig,
      };
    }
    case "error": {
      const message =
        typeof data.message === "string"
          ? data.message
          : tl.descriptions.errorGeneric;
      return {
        tone: "text-[var(--color-danger)]",
        label: tl.labels.error,
        description: message,
      };
    }
    default:
      return {
        tone: "text-[var(--color-text-muted)]",
        label: ev.event,
        description: Object.keys(data).length ? JSON.stringify(data) : "",
      };
  }
}

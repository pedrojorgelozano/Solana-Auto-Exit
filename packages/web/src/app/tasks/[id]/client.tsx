"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { Panel } from "@/components/Panel";
import { TokenPair } from "@/components/TokenBadge";
import { FieldError } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { positionDetailHref } from "@/lib/routes";
import { statusView, TONE_CLASSES, type BackendStatus } from "@/lib/status";
import {
  formatAmountWithSymbol,
  formatBuffer,
  formatBufferRemaining,
  formatDistance,
  formatPollInterval,
  formatPrice,
  formatSlippage,
  formatTimeAgo,
  formatTokenAmount,
  truncateAddress,
} from "@/lib/format";
import { tokenSymbol, tokenMeta } from "@/lib/tokens";
import { useT } from "@/i18n/context";

type TaskData = inferRouterOutputs<AppRouter>["tasks"]["get"];
type PositionSummary = inferRouterOutputs<
  AppRouter
>["positions"]["getSummary"];

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
const DEVNET_USDC_FALLBACK = "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k";

// ============================================================================
// Page wrapper
// ============================================================================

export default function TaskPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const utils = trpc.useUtils();
  const task = trpc.tasks.get.useQuery({ id }, { refetchInterval: 2_000 });
  const refresh = () => utils.tasks.get.invalidate({ id });
  const { t } = useT();

  return (
    <main className="mr-auto max-w-[1180px] px-8 pb-24 pt-8 fade-in">
      <Link
        href="/tasks"
        className="
          inline-flex items-center gap-[7px] text-[12.5px] font-medium
          text-[var(--color-text-dim)] transition-colors
          hover:text-[var(--color-accent)]
        "
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[14px] w-[14px]"
          aria-hidden
        >
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
        {t.taskDetail.backLabel}
      </Link>

      <div className="mt-6">
        {task.isLoading ? (
          <p className="t-small text-[var(--color-text-muted)]">
            {t.common.loading}
          </p>
        ) : task.error ? (
          <p className="t-small text-[var(--color-danger)]">
            {task.error.message}
          </p>
        ) : task.data ? (
          <Detail task={task.data} refresh={refresh} />
        ) : null}
      </div>
    </main>
  );
}

// ============================================================================
// Detail — root del rediseño
// ============================================================================

function Detail({ task, refresh }: { task: TaskData; refresh: () => void }) {
  const protocolConfig = task.protocolConfig as ProtocolConfigShape | null;
  const decimalsA = protocolConfig?.decimalsA ?? 9;
  const decimalsB = protocolConfig?.decimalsB ?? 6;
  // Desde F2.4 persistimos tokenMintA/tokenMintB en protocolConfig al crear
  // el task. Para tasks anteriores caemos al fallback (SOL en A, exitToken
  // o devUSDC en B).
  const mintA = protocolConfig?.tokenMintA ?? SOL_MINT;
  const mintB =
    protocolConfig?.tokenMintB ?? task.exitTokenMint ?? DEVNET_USDC_FALLBACK;

  // Wallet + listOwned + getSummary para el price band y el panel de holdings.
  // Si no hay summary (vault locked, posición cerrada/transferida), el hero
  // y el panel adaptan su contenido en vez de romperse.
  const walletStatus = trpc.wallet.status.useQuery();
  const owner = walletStatus.data?.address;
  const listOwned = trpc.positions.listOwned.useQuery(
    {
      protocol: task.protocol,
      network: task.network,
      rpcUrl: task.rpcUrl,
      owner: owner ?? "",
    },
    { enabled: !!owner },
  );
  const ref = listOwned.data?.find((r) => r.id === task.positionId);
  const summaryQuery = trpc.positions.getSummary.useQuery(
    {
      protocol: task.protocol,
      network: task.network,
      rpcUrl: task.rpcUrl,
      ref: ref ?? { protocol: "", id: "", label: "", poolId: "" },
    },
    { enabled: !!ref, refetchInterval: 10_000 },
  );
  const summary = summaryQuery.data ?? null;

  // History compartido entre receipts (verified deltas) y el timeline.
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

  return (
    <>
      <DetailHeader
        task={task}
        mintA={mintA}
        mintB={mintB}
        refresh={refresh}
      />

      {/* Recuperación de error → ancho completo encima del grid */}
      {task.status === "error" && task.lastError ? (
        <div className="mb-4">
          <ErrorRecovery
            taskId={task.id}
            positionId={task.positionId}
            message={task.lastError}
            slippageBps={task.slippageBps}
            triggered={task.triggeredAt !== null}
            refresh={refresh}
          />
        </div>
      ) : task.lastError ? (
        <div className="mb-4 border-l-2 border-[var(--color-danger)] pl-5">
          <div className="t-eyebrow text-[var(--color-danger)]">Last error</div>
          <p className="mt-2 break-words t-small text-[var(--color-text)]">
            {task.lastError}
          </p>
        </div>
      ) : null}

      <HeroPanel task={task} summary={summary} mintB={mintB} />

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1fr_332px]">
        <div className="flex min-w-0 flex-col gap-4">
          <TriggerCards task={task} />
          {summary ? (
            <HoldingsPanel summary={summary} />
          ) : null}
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
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <DetailsPanel task={task} />
        </aside>
      </div>

      <div className="mt-4">
        <ActivityTimelinePanel taskId={task.id} network={task.network} />
      </div>
    </>
  );
}

// ============================================================================
// DetailHeader — title row + meta + actions
// ============================================================================

function DetailHeader({
  task,
  mintA,
  mintB,
  refresh,
}: {
  task: TaskData;
  mintA: string;
  mintB: string;
  refresh: () => void;
}) {
  const { t } = useT();
  const view = statusView(task.status as BackendStatus);
  const tone = TONE_CLASSES[view.tone];
  const statusLabel =
    t.status[task.status as BackendStatus]?.label ?? task.status;
  const protoLabel =
    task.protocol === "orca"
      ? t.taskDetail.head.protocol.orca
      : task.protocol === "meteora"
        ? t.taskDetail.head.protocol.meteora
        : task.protocol;
  const symA = tokenSymbol(mintA);
  const symB = tokenSymbol(mintB);
  const armedRelative = formatTimeAgo(
    new Date(task.createdAt).getTime(),
    t,
  );
  const idShort = task.id.slice(-4);
  const pollLabel = formatPollInterval(task.pollMs);

  // El "explorer" enlaza a la cuenta de la position NFT (no a una tx). Solscan
  // acepta accounts. Si no hay positionMint, omitimos el link.
  const protocolConfig = task.protocolConfig as ProtocolConfigShape | null;
  const positionMint = protocolConfig?.positionMint;
  const explorerHref = positionMint
    ? `https://solscan.io/account/${positionMint}${
        task.network === "mainnet" ? "" : "?cluster=devnet"
      }`
    : null;

  return (
    <header className="mb-6 flex flex-col gap-5 border-b border-[var(--color-hairline)] pb-6 lg:flex-row lg:items-start lg:justify-between lg:gap-7">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <TokenPair mintA={mintA} mintB={mintB} size={26} />
          <h1 className="text-[28px] font-bold leading-none tracking-[-0.025em] md:text-[32px]">
            {symA} / {symB}
          </h1>
          <span
            className="
              rounded-md border px-[9px] py-1 text-[10.5px] font-semibold
              tracking-[0.05em]
            "
            style={{
              color: "#7fc7d6",
              borderColor: "rgba(127,199,214,0.34)",
              background: "rgba(127,199,214,0.08)",
            }}
          >
            {protoLabel}
          </span>
          <span
            className={`
              inline-flex items-center gap-2 rounded-full border px-3 py-[5px]
              text-[12.5px] font-semibold ${tone.bg} ${tone.border} ${tone.text}
            `}
          >
            <span
              className={`
                inline-block h-2 w-2 rounded-full ${tone.dot}
                ${view.pulsing ? "dot-pulse-ring" : ""}
              `}
              aria-hidden
            />
            {statusLabel}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[var(--color-text-dim)]">
          <NetworkPill network={task.network} />
          <Dot />
          <span>
            {t.taskDetail.head.armedPrefix}{" "}
            <span className="t-num text-[var(--color-text-muted)]">
              {armedRelative}
            </span>
          </span>
          <Dot />
          <span>
            {t.taskDetail.head.taskShortPrefix}{" "}
            <span className="t-num text-[var(--color-text-muted)]">
              #{idShort}
            </span>
          </span>
          <Dot />
          <span>
            {t.taskDetail.head.pollingPrefix}{" "}
            <span className="t-num text-[var(--color-text-muted)]">
              {pollLabel}
            </span>
          </span>
          {task.dryRun ? (
            <>
              <Dot />
              <span className="text-[var(--color-warning)]">
                {t.format.simulation}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <HeadActions
        task={task}
        refresh={refresh}
        explorerHref={explorerHref}
      />
    </header>
  );
}

function Dot() {
  return (
    <span
      className="inline-block h-[3px] w-[3px] rounded-full bg-[var(--color-text-dim)]"
      aria-hidden
    />
  );
}

function NetworkPill({ network }: { network: string }) {
  const { t } = useT();
  if (network === "mainnet") {
    return (
      <span
        className="
          inline-flex items-center gap-2 rounded-full
          border border-[var(--color-danger)] bg-[var(--color-danger-bg)]
          px-[10px] py-1 text-[10.5px] font-semibold uppercase
          tracking-[0.1em] text-[var(--color-danger)]
        "
      >
        <span
          className="inline-block h-[6px] w-[6px] rounded-full bg-[var(--color-danger)]"
          aria-hidden
        />
        {t.header.mainnetLive}
      </span>
    );
  }
  return (
    <Link
      href="/settings"
      className="
        inline-flex items-center gap-2 rounded-full
        border border-[var(--color-warning)] bg-[var(--color-warning-bg)]
        px-[10px] py-1 text-[10.5px] font-semibold uppercase
        tracking-[0.1em] text-[var(--color-warning)] transition-colors
        hover:bg-[var(--color-warning)] hover:text-[var(--color-bg)]
      "
    >
      <span
        className="inline-block h-[6px] w-[6px] rounded-full bg-[var(--color-warning)]"
        aria-hidden
      />
      {t.header.testMode}
    </Link>
  );
}

// ============================================================================
// HeadActions — Pause/Resume + Delete + Explorer link
// ============================================================================

function HeadActions({
  task,
  refresh,
  explorerHref,
}: {
  task: TaskData;
  refresh: () => void;
  explorerHref: string | null;
}) {
  const { t } = useT();
  const c = t.taskDetail.controls;
  const start = trpc.tasks.start.useMutation({ onSuccess: refresh });
  const pause = trpc.tasks.pause.useMutation({ onSuccess: refresh });
  const del = trpc.tasks.delete.useMutation({ onSuccess: refresh });

  const status = task.status as BackendStatus;
  const busy = start.isPending || pause.isPending || del.isPending;
  const err =
    start.error?.message ??
    pause.error?.message ??
    del.error?.message ??
    null;

  const isActive =
    status === "armed" || status === "triggered" || status === "closing";
  const canStart =
    status === "paused" || status === "idle" || status === "error";

  return (
    <div className="flex flex-none flex-wrap items-center gap-2">
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
      {explorerHref ? (
        <a
          href={explorerHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.taskDetail.head.openInExplorer}
          className="
            inline-flex h-[34px] w-[34px] items-center justify-center
            rounded-md border border-[var(--color-rule)]
            text-[var(--color-text)] transition-colors
            hover:bg-[var(--color-surface-hover)]
            hover:border-[var(--color-text-dim)]
          "
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[15px] w-[15px]"
            aria-hidden
          >
            <path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
          </svg>
        </a>
      ) : null}
      {err ? (
        <div className="basis-full">
          <FieldError>{err}</FieldError>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// HeroPanel — live price + 3 stats + price band
// ============================================================================

function HeroPanel({
  task,
  summary,
  mintB,
}: {
  task: TaskData;
  summary: PositionSummary | null;
  mintB: string;
}) {
  const { t } = useT();
  const h = t.taskDetail.heroPanel;
  // Reloj para el "Updated Xs ago · next poll in Ys". 1s refresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // Prioridad para precio: snapshot live del task (siempre disponible si el
  // watcher ha hecho al menos un tick). Si nunca ha tickeado, usa el del
  // summary como fallback (también es el spot price del pool).
  const currentPrice =
    task.runtime.lastPrice ?? summary?.currentPrice ?? null;
  const tpPrice = task.takeProfitPrice;
  const slPrice = task.stopLossPrice;

  const tpDistance =
    tpPrice !== null
      ? formatDistance(currentPrice, tpPrice, "above")
      : null;
  const slDistance =
    slPrice !== null
      ? formatDistance(currentPrice, slPrice, "below")
      : null;

  const lastTickAt = task.runtime.lastTickAt;
  const nowMs = Date.now();
  const updatedAgo =
    lastTickAt !== null ? formatTimeAgo(lastTickAt, t) : null;
  const nextPollMs =
    lastTickAt !== null ? lastTickAt + task.pollMs - nowMs : null;
  const nextPollText =
    nextPollMs !== null && nextPollMs > 0
      ? `${Math.ceil(nextPollMs / 1000)}s`
      : nextPollMs !== null
        ? "now"
        : null;

  return (
    <section
      className="
        rounded-[11px] border border-[var(--color-hairline)]
        bg-[var(--color-bg-elevated)] px-7 pb-8 pt-6
      "
      aria-label="Live price and trigger band"
    >
      <div className="flex flex-wrap items-start justify-between gap-8">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-dim)]">
            <span
              className="relative inline-block h-2 w-2 rounded-full bg-[var(--color-accent)] dot-pulse-ring"
              aria-hidden
            />
            {h.liveLabel}
          </span>
          <span className="text-[44px] font-medium leading-none tracking-[-0.035em] t-num md:text-[54px]">
            {currentPrice !== null ? formatPrice(currentPrice, 4) : "—"}
          </span>
          <span className="text-[12.5px] text-[var(--color-text-dim)]">
            {updatedAgo && nextPollText ? (
              <>
                {h.liveMetaPrefix(updatedAgo)}{" "}
                <b className="font-semibold text-[var(--color-accent)]">
                  {nextPollText}
                </b>
              </>
            ) : (
              h.liveMetaNoTick
            )}
          </span>
        </div>

        <div className="flex overflow-hidden rounded-md border border-[var(--color-hairline)] bg-[var(--color-paper)]">
          <HeroStat
            label={h.toTp}
            value={
              tpDistance && tpDistance.pct !== null
                ? `${Math.abs(tpDistance.pct).toFixed(1)}%`
                : "—"
            }
            tone="tp"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[14px] w-[14px]">
                <path d="M6 18 18 6M9 6h9v9" />
              </svg>
            }
          />
          <HeroStat
            label={h.toSl}
            value={
              slDistance && slDistance.pct !== null
                ? `${Math.abs(slDistance.pct).toFixed(1)}%`
                : "—"
            }
            tone="sl"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[14px] w-[14px]">
                <path d="M6 6 18 18M9 18h9V9" />
              </svg>
            }
          />
          {summary ? (
            <HeroStat
              label={h.poolRange}
              value={summary.isInRange ? h.inRange : h.outOfRange}
              tone={summary.isInRange ? "tp" : "sl"}
              icon={
                summary.isInRange ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[14px] w-[14px]">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[14px] w-[14px]">
                    <path d="M6 6 18 18M6 18 18 6" />
                  </svg>
                )
              }
            />
          ) : null}
        </div>
      </div>

      {summary && currentPrice !== null ? (
        <PriceBand
          currentPrice={currentPrice}
          rangeMin={summary.range.min}
          rangeMax={summary.range.max}
          tpPrice={tpPrice}
          slPrice={slPrice}
          isInRange={summary.isInRange}
          quoteSymbol={tokenSymbol(mintB)}
        />
      ) : null}
    </section>
  );
}

function HeroStat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "tp" | "sl";
  icon: React.ReactNode;
}) {
  const color =
    tone === "tp" ? "var(--color-accent)" : "var(--color-warning)";
  return (
    <div className="min-w-[128px] border-l border-[var(--color-hairline)] px-5 py-[13px] first:border-l-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-dim)]">
        {label}
      </div>
      <div
        className="mt-[6px] flex items-center gap-[6px] text-[18px] font-semibold"
        style={{ color }}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}

// ============================================================================
// PriceBand — visualización del rango de liquidez con triggers + precio
// ============================================================================

function PriceBand({
  currentPrice,
  rangeMin,
  rangeMax,
  tpPrice,
  slPrice,
  isInRange,
  quoteSymbol,
}: {
  currentPrice: number;
  rangeMin: number;
  rangeMax: number;
  tpPrice: number | null;
  slPrice: number | null;
  isInRange: boolean;
  quoteSymbol: string;
}) {
  const { t } = useT();
  const h = t.taskDetail.heroPanel;

  // Domain: incluye rango + triggers + precio actual, con 5% de padding a
  // cada lado para que ningún marcador quede en el borde exacto.
  const values: number[] = [rangeMin, rangeMax, currentPrice];
  if (tpPrice !== null) values.push(tpPrice);
  if (slPrice !== null) values.push(slPrice);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const pad = Math.max((maxV - minV) * 0.05, maxV * 0.005);
  const lo = Math.max(0, minV - pad);
  const hi = maxV + pad;
  const span = hi - lo;
  const pct = (v: number) =>
    Math.max(0, Math.min(100, ((v - lo) / span) * 100));

  const priceX = pct(currentPrice);
  const rangeLoX = pct(rangeMin);
  const rangeHiX = pct(rangeMax);
  const slX = slPrice !== null ? pct(slPrice) : null;
  const tpX = tpPrice !== null ? pct(tpPrice) : null;

  const ticks = Array.from(
    { length: 5 },
    (_, i) => lo + (span * i) / 4,
  );

  const ariaLabel = h.bandAria({
    lo: formatPrice(lo, 2),
    hi: formatPrice(hi, 2),
    rangeLo: formatPrice(rangeMin, 2),
    rangeHi: formatPrice(rangeMax, 2),
    sl: slPrice !== null ? formatPrice(slPrice, 2) : null,
    tp: tpPrice !== null ? formatPrice(tpPrice, 2) : null,
    currentPrice: formatPrice(currentPrice, 2),
    inRange: isInRange,
  });

  return (
    <div className="mt-7">
      <div
        className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[11.5px] text-[var(--color-text-muted)]"
        aria-hidden
      >
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-[9px] w-4 rounded-[2px] border border-dashed border-[var(--color-rule)]"
            style={{ background: "var(--color-accent-dim)" }}
            aria-hidden
          />
          {h.bandLegendRange}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-[13px] w-[2px] rounded-[1px] bg-[var(--color-warning)]"
            aria-hidden
          />
          {h.bandLegendSl}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-[13px] w-[2px] rounded-[1px] bg-[var(--color-accent)]"
            aria-hidden
          />
          {h.bandLegendTp}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-[13px] w-[2px] rounded-[1px] bg-[var(--color-text)]"
            aria-hidden
          />
          {h.bandLegendPrice}
        </span>
      </div>

      <div className="relative" role="img" aria-label={ariaLabel}>
        {/* Top: price pill + stem */}
        <div className="relative h-[38px]">
          <div
            className="absolute bottom-0 flex flex-col items-center"
            style={{ left: `${priceX}%`, transform: "translateX(-50%)" }}
          >
            <span
              className="
                whitespace-nowrap rounded-md border border-[var(--color-accent)]
                bg-[var(--color-bg)] px-[10px] py-1 text-[13px]
                font-semibold text-[var(--color-text)] t-num
              "
              style={{ boxShadow: "0 0 18px rgba(95,214,164,0.18)" }}
            >
              {formatPrice(currentPrice, 4)}
              {quoteSymbol ? (
                <span className="ml-1 text-[10.5px] font-medium text-[var(--color-text-muted)]">
                  {quoteSymbol}
                </span>
              ) : null}
            </span>
            <span
              className="h-2 w-[2px] bg-[var(--color-accent)]"
              aria-hidden
            />
          </div>
        </div>

        {/* Scale */}
        <div className="relative h-[62px] overflow-hidden rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper)]">
          {/* Liquidity range zone */}
          <div
            className="absolute top-0 bottom-0 border-l border-r border-dashed border-[var(--color-rule)]"
            style={{
              left: `${rangeLoX}%`,
              width: `${Math.max(0, rangeHiX - rangeLoX)}%`,
              background:
                "linear-gradient(180deg,rgba(95,214,164,0.16),rgba(95,214,164,0.06))",
            }}
          >
            <span className="absolute left-[10px] top-2 text-[9.5px] font-semibold uppercase tracking-[0.13em] text-[var(--color-accent)] opacity-85">
              {h.zoneTag}
            </span>
            <span className="absolute bottom-[5px] left-[6px] t-num text-[10.5px] font-semibold text-[var(--color-accent)]">
              {formatPrice(rangeMin, 4)}
            </span>
            <span className="absolute bottom-[5px] right-[6px] t-num text-[10.5px] font-semibold text-[var(--color-accent)]">
              {formatPrice(rangeMax, 4)}
            </span>
          </div>
          {/* SL mark */}
          {slX !== null ? (
            <div
              className="absolute top-0 bottom-0 z-[2] w-[2px] bg-[var(--color-warning)]"
              style={{ left: `${slX}%` }}
              aria-hidden
            />
          ) : null}
          {/* TP mark */}
          {tpX !== null ? (
            <div
              className="absolute top-0 bottom-0 z-[2] w-[2px] bg-[var(--color-accent)]"
              style={{ left: `${tpX}%` }}
              aria-hidden
            />
          ) : null}
          {/* Price node */}
          <div
            className="absolute top-0 bottom-0 z-[3] w-[2px] bg-[var(--color-text)]"
            style={{
              left: `${priceX}%`,
              boxShadow: "0 0 14px rgba(237,238,240,0.45)",
            }}
            aria-hidden
          >
            <span
              className="absolute left-1/2 top-1/2 h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--color-paper)] bg-[var(--color-text)]"
              style={{ boxShadow: "0 0 0 1.5px var(--color-accent)" }}
            />
          </div>
        </div>

        {/* Bottom: flags */}
        <div className="relative mt-2 h-[50px]">
          {slX !== null && slPrice !== null ? (
            <BandFlag
              x={slX}
              kind="sl"
              price={slPrice}
              label={h.bandLegendSl}
            />
          ) : null}
          {tpX !== null && tpPrice !== null ? (
            <BandFlag
              x={tpX}
              kind="tp"
              price={tpPrice}
              label={h.bandLegendTp}
            />
          ) : null}
        </div>

        {/* Axis */}
        <div
          className="flex justify-between text-[10.5px] text-[var(--color-text-dim)] t-num"
          aria-hidden
        >
          {ticks.map((tk, i) => (
            <span key={i}>{formatPrice(tk, 2)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BandFlag({
  x,
  kind,
  price,
  label,
}: {
  x: number;
  kind: "tp" | "sl";
  price: number;
  label: string;
}) {
  const isTp = kind === "tp";
  const color = isTp ? "var(--color-accent)" : "var(--color-warning)";
  return (
    <div
      className="absolute top-0 flex flex-col items-center gap-[3px]"
      style={{ left: `${x}%`, transform: "translateX(-50%)" }}
    >
      <span
        className="mb-[1px] block h-[7px] w-[7px] rotate-45 rounded-[1px]"
        style={{ background: color }}
        aria-hidden
      />
      <span
        className="text-[9.5px] font-semibold uppercase tracking-[0.1em]"
        style={{ color }}
      >
        {label}
      </span>
      <span className="t-num text-[12.5px] font-semibold text-[var(--color-text)]">
        {formatPrice(price, 4)}
      </span>
    </div>
  );
}

// ============================================================================
// TriggerCards — TP/SL en grid 2×
// ============================================================================

function TriggerCards({ task }: { task: TaskData }) {
  const tpPrice = task.takeProfitPrice;
  const slPrice = task.stopLossPrice;
  if (tpPrice === null && slPrice === null) return null;

  const lastPrice = task.runtime.lastPrice;
  const tpDistance =
    tpPrice !== null ? formatDistance(lastPrice, tpPrice, "above") : null;
  const slDistance =
    slPrice !== null ? formatDistance(lastPrice, slPrice, "below") : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {tpPrice !== null ? (
        <TriggerCard
          kind="tp"
          price={tpPrice}
          distance={tpDistance}
          triggered={task.triggeredBy === "take_profit"}
          bufferMs={task.takeProfitBufferMs}
          firstCrossedAt={task.runtime.tpFirstCrossedAt}
        />
      ) : null}
      {slPrice !== null ? (
        <TriggerCard
          kind="sl"
          price={slPrice}
          distance={slDistance}
          triggered={task.triggeredBy === "stop_loss"}
          bufferMs={task.stopLossBufferMs}
          firstCrossedAt={task.runtime.slFirstCrossedAt}
        />
      ) : null}
    </div>
  );
}

function TriggerCard({
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
  const tc = t.taskDetail.triggerCard;
  const isTp = kind === "tp";
  const stripe = isTp ? "var(--color-accent)" : "var(--color-warning)";
  const op = isTp ? "≥" : "≤";
  const label = isTp ? tc.tp : tc.sl;
  const iconBg = isTp ? "var(--color-accent-dim)" : "var(--color-warning-bg)";
  const iconColor = isTp ? "var(--color-accent)" : "var(--color-warning)";
  const distPct = distance?.pct ?? null;
  // Barra: 100% cuando el trigger está cumplido o muy cerca; baja al 0%
  // cuando el precio está al 50% de distancia o más.
  const barWidth =
    distPct === null
      ? 0
      : distance?.reached
        ? 100
        : Math.max(0, Math.min(100, 100 - Math.abs(distPct) * 2));

  const remaining = formatBufferRemaining(
    firstCrossedAt,
    bufferMs,
    Date.now(),
    t,
  );

  return (
    <article
      className="
        relative overflow-hidden rounded-[11px]
        border border-[var(--color-hairline)]
        bg-[var(--color-bg-elevated)] p-5
      "
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: stripe }}
        aria-hidden
      />

      <div className="mb-3 flex items-center gap-[9px]">
        <span
          className="grid h-6 w-6 place-items-center rounded-md"
          style={{ color: iconColor, background: iconBg }}
          aria-hidden
        >
          {isTp ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-[14px] w-[14px]">
              <path d="M6 18 18 6M9 6h9v9" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-[14px] w-[14px]">
              <path d="M6 6 18 18M9 18h9V9" />
            </svg>
          )}
        </span>
        <span className="text-[13px] font-semibold text-[var(--color-text)]">
          {label}
        </span>
        <span
          className={`
            ml-auto rounded-md border px-[7px] py-[2px]
            text-[10px] font-semibold uppercase tracking-[0.08em]
            ${
              triggered
                ? "border-[var(--color-warning)] text-[var(--color-warning)]"
                : "border-[var(--color-rule)] text-[var(--color-text-dim)]"
            }
          `}
        >
          {triggered ? tc.firedBadge : tc.armedBadge}
        </span>
      </div>

      <div className="t-num text-[28px] font-medium leading-none tracking-[-0.02em] text-[var(--color-text)] md:text-[30px]">
        {op} {formatPrice(price, 4)}
      </div>

      <div className="mt-4 flex items-baseline justify-between text-[12px] text-[var(--color-text-dim)]">
        <span>{tc.distance}</span>
        <b className="t-num text-[13px] font-semibold text-[var(--color-text-muted)]">
          {distance && distance.pct !== null
            ? distance.reached
              ? tc.reached
              : `${Math.abs(distance.pct).toFixed(1)}%`
            : "—"}
        </b>
      </div>
      <div className="mt-2 h-[5px] overflow-hidden rounded-[3px] bg-[var(--color-hairline)]">
        <span
          className="block h-full rounded-[3px]"
          style={{
            width: `${barWidth}%`,
            background: isTp
              ? "linear-gradient(90deg,var(--color-accent-deep),var(--color-accent))"
              : "linear-gradient(90deg,#6d5527,var(--color-warning))",
          }}
        />
      </div>

      <div className="mt-4 flex items-start gap-2 text-[11.5px] text-[var(--color-text-dim)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[13px] w-[13px] flex-none opacity-80"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
        <span>
          {bufferMs && bufferMs > 0
            ? isTp
              ? tc.bufferFootTp(formatPrice(price, 4), formatBuffer(bufferMs, t))
              : tc.bufferFootSl(formatPrice(price, 4), formatBuffer(bufferMs, t))
            : tc.noBufferFoot}
          {remaining ? (
            <>
              {" · "}
              <span
                className={
                  remaining === t.format.bufferMet
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-accent-bright)]"
                }
              >
                {remaining}
              </span>
            </>
          ) : null}
        </span>
      </div>
    </article>
  );
}

// ============================================================================
// HoldingsPanel — 2×2 con liquidez, fees, range status, estimated value
// ============================================================================

function HoldingsPanel({ summary }: { summary: PositionSummary }) {
  const { t } = useT();
  const ho = t.taskDetail.holdings;
  const symA = tokenSymbol(summary.tokenA.mint);
  const symB = tokenSymbol(summary.tokenB.mint);
  const decA = summary.tokenA.decimals;
  const decB = summary.tokenB.decimals;
  const price = summary.currentPrice;

  // Estimated value en términos del quote (token B). Suma de liquidez +
  // pending fees. No depende de oracle externo — solo del spot del pool.
  const tokenAUnits = (raw: string) => Number(raw) / 10 ** decA;
  const tokenBUnits = (raw: string) => Number(raw) / 10 ** decB;
  const liqAUnits = tokenAUnits(summary.liquidity.tokenA);
  const liqBUnits = tokenBUnits(summary.liquidity.tokenB);
  const feesAUnits = summary.feesPending
    ? tokenAUnits(summary.feesPending.tokenA)
    : 0;
  const feesBUnits = summary.feesPending
    ? tokenBUnits(summary.feesPending.tokenB)
    : 0;
  const valueInB = liqAUnits * price + liqBUnits + feesAUnits * price + feesBUnits;
  const feesValueInB = feesAUnits * price + feesBUnits;

  const fmtUnits = (n: number, maxDecimals = 4) => {
    if (!Number.isFinite(n)) return "—";
    if (n === 0) return "0";
    if (Math.abs(n) >= 1000) return n.toFixed(2);
    return Number(n.toFixed(maxDecimals)).toString();
  };

  return (
    <Panel
      title={ho.title}
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[14px] w-[14px]">
          <path d="M3 7h18M3 12h18M3 17h18" />
        </svg>
      }
      description={ho.refreshed}
    >
      <dl className="grid gap-px overflow-hidden rounded-md border border-[var(--color-hairline)] bg-[var(--color-hairline)] sm:grid-cols-2">
        <HoldingCell label={ho.liquidity}>
          <HoldingRow value={fmtUnits(liqAUnits, 4)} symbol={symA} />
          <HoldingRow value={fmtUnits(liqBUnits, 2)} symbol={symB} />
        </HoldingCell>
        <HoldingCell label={ho.pendingFees}>
          {summary.feesPending ? (
            <>
              <HoldingRow value={fmtUnits(feesAUnits, 4)} symbol={symA} />
              <HoldingRow value={fmtUnits(feesBUnits, 2)} symbol={symB} />
              {feesValueInB > 0 ? (
                <p className="mt-1 text-[11px] text-[var(--color-text-dim)]">
                  {ho.feesValueNote(
                    `${fmtUnits(feesValueInB, 2)} ${symB}`,
                  )}
                </p>
              ) : null}
            </>
          ) : (
            <span className="t-num text-[var(--color-text-dim)]">
              {ho.noFees}
            </span>
          )}
        </HoldingCell>
        <HoldingCell label={ho.rangeStatus}>
          {summary.isInRange ? (
            <span className="inline-flex items-center gap-[6px] text-[14px] font-semibold text-[var(--color-accent)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-[14px] w-[14px]" aria-hidden>
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {t.taskDetail.heroPanel.inRange}
            </span>
          ) : (
            <span className="inline-flex items-center gap-[6px] text-[14px] font-semibold text-[var(--color-warning)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-[14px] w-[14px]" aria-hidden>
                <path d="M6 6 18 18M6 18 18 6" />
              </svg>
              {t.taskDetail.heroPanel.outOfRange}
            </span>
          )}
          <p className="mt-[6px] text-[11px] text-[var(--color-text-dim)]">
            {summary.isInRange
              ? ho.rangeWithStatus(
                  formatPrice(summary.range.min, 2),
                  formatPrice(summary.range.max, 2),
                )
              : ho.rangeWhenOut(
                  formatPrice(summary.range.min, 2),
                  formatPrice(summary.range.max, 2),
                )}
          </p>
        </HoldingCell>
        <HoldingCell label={ho.estimatedValue}>
          <span className="t-num text-[19px] font-semibold text-[var(--color-text)]">
            ≈ {fmtUnits(valueInB, 2)}{" "}
            <span className="text-[11px] font-semibold text-[var(--color-text-dim)]">
              {symB}
            </span>
          </span>
          <p className="mt-[5px] text-[11px] text-[var(--color-text-dim)]">
            {ho.estimatedValueNote}
          </p>
        </HoldingCell>
      </dl>
    </Panel>
  );
}

function HoldingCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-bg-elevated)] px-4 py-[15px]">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dim)]">
        {label}
      </dt>
      <dd className="mt-2 flex flex-col gap-[3px]">{children}</dd>
    </div>
  );
}

function HoldingRow({ value, symbol }: { value: string; symbol: string }) {
  return (
    <span className="flex items-center gap-[7px]">
      <span className="t-num text-[15px] font-semibold text-[var(--color-text)]">
        {value}
      </span>
      <span className="text-[10.5px] font-semibold text-[var(--color-text-dim)]">
        {symbol}
      </span>
    </span>
  );
}

// ============================================================================
// DetailsPanel — facts del task
// ============================================================================

function DetailsPanel({ task }: { task: TaskData }) {
  const { t } = useT();
  const d = t.taskDetail.detailsPanel;
  const protoLabel =
    task.protocol === "orca"
      ? t.taskDetail.head.protocol.orca
      : task.protocol === "meteora"
        ? t.taskDetail.head.protocol.meteora
        : task.protocol;
  const protocolConfig = task.protocolConfig as ProtocolConfigShape | null;
  const positionMint = protocolConfig?.positionMint ?? task.positionId;
  const hasBuffer =
    (task.takeProfitBufferMs && task.takeProfitBufferMs > 0) ||
    (task.stopLossBufferMs && task.stopLossBufferMs > 0);

  return (
    <Panel
      title={d.title}
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[14px] w-[14px]">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      }
    >
      <dl className="flex flex-col">
        <Fact label={d.protocol}>{protoLabel}</Fact>
        <Fact label={d.network}>
          <span
            className={
              task.network === "mainnet"
                ? "text-[var(--color-danger)]"
                : "text-[var(--color-text)]"
            }
          >
            {task.network === "mainnet" ? d.networkMainnet : d.networkDevnet}
          </span>
        </Fact>
        {task.exitTokenMint ? (
          <Fact label={d.exitToken}>
            <ExitTokenChip mint={task.exitTokenMint} />
          </Fact>
        ) : (
          <Fact label={d.exitToken}>
            <span className="text-[var(--color-text-dim)]">
              {d.exitTokenNone}
            </span>
          </Fact>
        )}
        {hasBuffer ? (
          <Fact label={d.timeBuffer} mono>
            {task.takeProfitBufferMs && task.takeProfitBufferMs > 0
              ? `TP ${formatBuffer(task.takeProfitBufferMs, t)}`
              : null}
            {task.takeProfitBufferMs &&
            task.takeProfitBufferMs > 0 &&
            task.stopLossBufferMs &&
            task.stopLossBufferMs > 0
              ? " · "
              : null}
            {task.stopLossBufferMs && task.stopLossBufferMs > 0
              ? `SL ${formatBuffer(task.stopLossBufferMs, t)}`
              : null}
          </Fact>
        ) : (
          <Fact label={d.timeBuffer} mono>
            {d.bufferDash}
          </Fact>
        )}
        <Fact label={d.pollInterval} mono>
          {formatPollInterval(task.pollMs)}
        </Fact>
        <Fact label={d.closeSlippage} mono>
          {formatSlippage(task.slippageBps)}
        </Fact>
        {task.exitTokenMint ? (
          <Fact label={d.swapSlippage} mono>
            {formatSlippage(task.exitSwapSlippageBps)}
          </Fact>
        ) : null}
        <Fact label={d.positionMint} mono>
          {truncateAddress(positionMint, 4, 4)}
        </Fact>
      </dl>
    </Panel>
  );
}

function Fact({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-hairline)] py-[11px] last:border-b-0">
      <dt className="text-[12.5px] text-[var(--color-text-dim)]">{label}</dt>
      <dd
        className={`text-[12.5px] font-semibold text-[var(--color-text)] text-right ${
          mono ? "t-num" : ""
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

function ExitTokenChip({ mint }: { mint: string }) {
  const sym = tokenSymbol(mint);
  return (
    <span
      className="
        inline-flex items-center gap-[6px] rounded-full
        border border-[var(--color-rule)] px-2 py-[3px]
        text-[11.5px] font-semibold text-[var(--color-text)]
      "
    >
      <span
        className="
          grid h-[14px] w-[14px] place-items-center rounded-full
          bg-[var(--color-accent-dim)] text-[8px] font-bold
          text-[var(--color-accent)]
        "
        aria-hidden
      >
        {sym.slice(0, 1)}
      </span>
      {sym}
    </span>
  );
}

// ============================================================================
// CloseReceipt + SwapReceipt — refactor a Panel
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
  const actualARaw = verified ? rawDeltaForMint(verified, mintA) : null;
  const actualBRaw = verified ? rawDeltaForMint(verified, mintB) : null;

  return (
    <Panel
      title={r.recoveredTitle}
      description={`${r.closedHeader}${data.dryRun ? r.closedSimulated : ""}`}
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[14px] w-[14px]">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      }
    >
      <div className="mb-3 flex justify-end">
        {data.txId ? <SolscanLink sig={data.txId} network={network} /> : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
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
        <p className="mt-5 t-small text-[var(--color-text-dim)]">
          {r.solDeltaNote}
        </p>
      ) : null}
      {data.notes ? (
        <p className="mt-5 t-small text-[var(--color-text-muted)]">
          {data.notes}
        </p>
      ) : null}
    </Panel>
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
      <Panel
        title={sw.skippedTitle}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[14px] w-[14px]">
            <path d="M5 12h14" />
          </svg>
        }
      >
        <p className="t-small text-[var(--color-text-muted)]">
          {data.notes ?? sw.skippedFallback}
        </p>
      </Panel>
    );
  }

  const fromSym = data.fromMint ? tokenSymbol(data.fromMint) : "?";
  const toSym = exitTokenMint ? tokenSymbol(exitTokenMint) : "?";
  const isFromA = data.fromMint === mintA;
  const fromDecimals = isFromA ? decimalsA : decimalsB;
  const toDecimals = isFromA ? decimalsB : decimalsA;

  let actualInputRaw: string | null = null;
  let actualOutputRaw: string | null = null;
  if (verified && data.fromMint) {
    if (data.fromMint === SOL_MINT) {
      const fee = BigInt(verified.fee);
      const sol = BigInt(verified.solDelta);
      actualInputRaw = (-sol - fee).toString();
    } else {
      const tokenDelta = BigInt(verified.tokenDeltas[data.fromMint] ?? "0");
      actualInputRaw = (-tokenDelta).toString();
    }
  }
  if (verified && exitTokenMint) {
    actualOutputRaw = rawDeltaForMint(verified, exitTokenMint);
  }

  return (
    <Panel
      title={`${fromSym} → ${toSym}`}
      description={`${sw.header}${data.dryRun ? sw.simulated : ""}`}
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[14px] w-[14px]">
          <path d="M3 12h14M13 6l6 6-6 6" />
        </svg>
      }
    >
      <div className="mb-3 flex justify-end">
        {data.txId ? <SolscanLink sig={data.txId} network={network} /> : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3">
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
      {data.notes ? (
        <p className="mt-5 t-small text-[var(--color-text-muted)]">
          {data.notes}
        </p>
      ) : null}
    </Panel>
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

// ============================================================================
// ActivityTimelinePanel — refactor con nodos coloreados
// ============================================================================

type HistoryEvent = inferRouterOutputs<AppRouter>["tasks"]["history"][number];

function ActivityTimelinePanel({
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
      <Panel
        title={tl.eyebrow}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[14px] w-[14px]">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        }
      >
        <p className="t-small text-[var(--color-text-dim)]">
          {t.common.loading}
        </p>
      </Panel>
    );
  }

  const events = history.data ?? [];
  if (events.length === 0) {
    return null;
  }

  return (
    <Panel
      title={tl.eyebrow}
      description={tl.events(events.length)}
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[14px] w-[14px]">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      }
    >
      <ol className="relative flex max-w-[680px] flex-col">
        <span
          className="pointer-events-none absolute left-[6px] top-2 bottom-3 w-px bg-[var(--color-hairline)]"
          aria-hidden
        />
        {events.map((ev, i) => (
          <TimelineRow
            key={ev.id}
            ev={ev}
            network={network}
            isFirst={i === 0}
          />
        ))}
      </ol>
    </Panel>
  );
}

function TimelineRow({
  ev,
  network,
  isFirst,
}: {
  ev: HistoryEvent;
  network: string;
  isFirst: boolean;
}) {
  const { t } = useT();
  const desc = describeEvent(ev, t);
  const timestamp =
    typeof ev.timestamp === "string"
      ? new Date(ev.timestamp).getTime()
      : new Date(ev.timestamp as unknown as string | number).getTime();
  const relative = isFirst ? t.format.justNow : formatTimeAgo(timestamp, t);

  // Estilo del nodo según semántica del evento
  const nodeKind: "live" | "alert" | "armed" | "ok" | "muted" =
    isFirst && ev.event === "started"
      ? "live"
      : ev.event === "triggered" ||
          ev.event === "buffer_armed" ||
          ev.event === "paused" ||
          ev.event === "error"
        ? "alert"
        : ev.event === "started" || ev.event === "resumed"
          ? "armed"
          : ev.event === "closed" || ev.event === "swapped" || ev.event === "verified"
            ? "ok"
            : "muted";

  return (
    <li className="relative pl-7 pr-1 pb-5 last:pb-1">
      <span
        className={
          "absolute left-0 top-1 grid h-[13px] w-[13px] place-items-center rounded-full " +
          nodeStyle(nodeKind)
        }
        aria-hidden
      >
        {nodeKind === "live" ? (
          <span
            className="absolute -inset-[5px] rounded-full border border-[var(--color-accent)] dot-pulse-ring"
            aria-hidden
          />
        ) : null}
      </span>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--color-text-dim)]">
        {relative}
      </div>
      <div
        className={`mt-[3px] text-[13px] font-semibold ${nodeKind === "alert" ? "text-[var(--color-warning)]" : nodeKind === "ok" || nodeKind === "live" || nodeKind === "armed" ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"}`}
      >
        {desc.label}
      </div>
      <div className="mt-[3px] text-[12px] leading-[1.5] text-[var(--color-text-dim)]">
        {desc.description}
        {desc.txId ? (
          <span className="ml-2">
            <SolscanLink sig={desc.txId} network={network} />
          </span>
        ) : null}
      </div>
    </li>
  );
}

function nodeStyle(kind: "live" | "alert" | "armed" | "ok" | "muted"): string {
  switch (kind) {
    case "live":
      return "bg-[var(--color-accent)] border-2 border-[var(--color-accent)]";
    case "alert":
      return "bg-[var(--color-warning)] border-2 border-[var(--color-warning)]";
    case "armed":
      return "bg-[var(--color-bg)] border-2 border-[var(--color-accent)]";
    case "ok":
      return "bg-[var(--color-accent)] border-2 border-[var(--color-accent-deep)]";
    case "muted":
    default:
      return "bg-[var(--color-bg)] border-2 border-[var(--color-rule)]";
  }
}

// ============================================================================
// Verified deltas + ActualLine — sin cambios funcionales
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

function rawDeltaForMint(verified: VerifiedDeltas, mint: string): string {
  if (mint === SOL_MINT) return verified.solDelta;
  return verified.tokenDeltas[mint] ?? "0";
}

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
// ErrorRecovery — sin cambios funcionales (solo cambia su sitio en el grid)
// ============================================================================

function isSlippageError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("slippage") ||
    m.includes("tolerance") ||
    m.includes("price impact") ||
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
      router.push(positionDetailHref(positionId));
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
              href={positionDetailHref(positionId)}
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
// describeEvent — sin cambios funcionales
// ============================================================================

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

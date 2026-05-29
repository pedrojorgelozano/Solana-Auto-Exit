"use client";

import Link from "next/link";
import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@solana-auto-exit/server/api";

import { Button } from "@/components/ui/Button";
import { TextAction } from "@/components/ui/TextAction";
import { DocsLink } from "@/components/ui/DocsLink";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { positionDetailHref, taskDetailHref } from "@/lib/routes";
import { useConnectWallet } from "@/lib/connect-wallet";
import { useT } from "@/i18n/context";
import { type BackendStatus } from "@/lib/status";
import { formatNearestDistance, formatPrice } from "@/lib/format";
import { tokenSymbol } from "@/lib/tokens";
import { TriggerBand } from "@/components/TriggerBand";
import { BufferCountdown } from "@/components/BufferCountdown";
import { DashboardAlerts } from "@/components/DashboardAlerts";
import { HistoryLedger } from "@/components/HistoryLedger";
import {
  NETWORK,
  PROTOCOL_LABELS,
  type ProtocolName,
  RPC_URL,
} from "@/lib/constants";

type TaskRow = inferRouterOutputs<AppRouter>["tasks"]["list"][number];
type PositionRef = inferRouterOutputs<AppRouter>["positions"]["listOwned"][number];

const ACTIVE_STATES: BackendStatus[] = [
  "idle",
  "armed",
  "triggered",
  "closing",
  "paused",
];
const FINISHED_STATES: BackendStatus[] = ["done", "error", "stopped"];

export default function Home() {
  const walletStatus = trpc.wallet.status.useQuery(undefined, {
    refetchInterval: 5_000,
  });

  if (walletStatus.isLoading) {
    return <main className="mr-auto max-w-6xl px-6 pt-16" />;
  }
  if (!walletStatus.data?.hasVault) {
    return <FirstRunHome />;
  }
  return (
    <ConnectedHome
      owner={walletStatus.data.address}
      unlocked={walletStatus.data.unlocked}
    />
  );
}

// ============================================================================
// Connected home — el usuario ya tiene wallet. Hub directo de posiciones.
// ============================================================================

function ConnectedHome({
  owner,
  unlocked,
}: {
  owner: string | null;
  unlocked: boolean;
}) {
  const settings = trpc.settings.get.useQuery();
  const network = settings.data?.network ?? NETWORK;
  const rpcUrl = settings.data?.rpcUrl ?? RPC_URL;

  // Listamos posiciones de ambos protocolos en paralelo. La query solo
  // se dispara cuando hay owner — el peek-address del vault funciona
  // incluso locked, así que el listado se ve también en estado locked.
  const orcaList = trpc.positions.listOwned.useQuery(
    { protocol: "orca", network, rpcUrl, owner: owner ?? "" },
    { enabled: !!owner },
  );
  const meteoraList = trpc.positions.listOwned.useQuery(
    { protocol: "meteora", network, rpcUrl, owner: owner ?? "" },
    { enabled: !!owner },
  );

  const tasks = trpc.tasks.list.useQuery(undefined, { refetchInterval: 3_000 });

  // Mapa positionId → task activa (regla "una posición = un auto-exit" → ADR-019).
  const activeByPosition = new Map<string, TaskRow>();
  for (const t of tasks.data ?? []) {
    if (ACTIVE_STATES.includes(t.status as BackendStatus)) {
      activeByPosition.set(t.positionId, t);
    }
  }

  const allRefs: PositionRef[] = [
    ...(orcaList.data ?? []),
    ...(meteoraList.data ?? []),
  ];
  const isLoadingAll = orcaList.isLoading && meteoraList.isLoading;
  const watchingCount = allRefs.filter((r) =>
    activeByPosition.has(r.id),
  ).length;

  const finished = (tasks.data ?? []).filter((t) =>
    FINISHED_STATES.includes(t.status as BackendStatus),
  );

  return (
    <main className="mr-auto max-w-6xl px-6 pb-32 pt-12 fade-in md:px-12">
      <DashboardHeader
        totalPositions={allRefs.length}
        isLoading={isLoadingAll}
      />

      {!unlocked ? <LockedCallout /> : null}

      <DashboardAlerts owner={owner} unlocked={unlocked} />

      <PositionsHub
        refs={allRefs}
        activeByPosition={activeByPosition}
        network={network}
        rpcUrl={rpcUrl}
        owner={owner}
        isLoading={isLoadingAll}
        anyError={
          orcaList.error?.message ?? meteoraList.error?.message ?? null
        }
      />

      <RecentActivity tasks={finished} />
    </main>
  );
}

/**
 * PageHeader del dashboard. La address y los counters de "watching" viven
 * ahora en otros sitios (sidebar y stat strip respectivamente), así que el
 * header se queda con eyebrow + título + descripción dinámica con el
 * número de posiciones detectadas.
 */
function DashboardHeader({
  totalPositions,
  isLoading,
}: {
  totalPositions: number;
  isLoading: boolean;
}) {
  const { t } = useT();
  const d = t.home.dashboard;
  const description = isLoading
    ? d.descriptionLoading
    : totalPositions === 0
      ? d.descriptionNone
      : totalPositions === 1
        ? d.descriptionOne
        : d.descriptionMany(totalPositions);

  return (
    <PageHeader
      eyebrow={d.eyebrow}
      title={d.title}
      description={description}
    />
  );
}

/**
 * LockedCallout — banner amber con border-left, icono candado, eyebrow + body
 * + CTA a /wallet. Solo se muestra cuando la wallet está bloqueada en el
 * dashboard (es el bloqueador #1 para usar la app — sin desbloquear no se
 * arma ningún auto-exit).
 */
function LockedCallout() {
  const { t } = useT();
  const d = t.home.dashboard;
  return (
    <div
      role="status"
      aria-live="polite"
      className="
        mt-6 flex items-center gap-4
        rounded-[10px] border border-[var(--color-hairline)]
        border-l-[3px] border-l-[var(--color-warning)]
        bg-[var(--color-bg-elevated)]
        px-5 py-4
      "
    >
      <span
        className="
          inline-flex h-9 w-9 flex-none items-center justify-center
          rounded-full bg-[var(--color-warning)]/12
        "
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-warning)"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[17px] w-[17px]"
        >
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--color-warning)]">
          {d.lockedEyebrow}
        </div>
        <p className="mt-1 text-[15px] text-[var(--color-text)]">
          {d.lockedBody}
        </p>
      </div>
      <Link
        href="/wallet"
        className="
          inline-flex flex-none items-center gap-2 self-center
          rounded-[7px] border border-[var(--color-warning)]/45
          px-3.5 py-2 text-[12px] font-semibold uppercase tracking-[0.18em]
          text-[var(--color-warning)]
          transition-colors hover:bg-[var(--color-warning)]/10
        "
      >
        {d.lockedCta}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[13px] w-[13px]"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}

// ============================================================================
// BotWalletEyebrow — eliminado en el rediseño "refined minimal dark". La
// info que mostraba (address + counters) ahora vive en el sidebar
// (WalletBeacon) y en StatStrip. Las strings i18n `home.eyebrow.*` quedan
// huérfanas a propósito por si revertimos.
// ============================================================================

// ============================================================================
// Positions hub — la tabla principal del home
// ============================================================================

function PositionsHub({
  refs,
  activeByPosition,
  network,
  rpcUrl,
  owner,
  isLoading,
  anyError,
}: {
  refs: PositionRef[];
  activeByPosition: Map<string, TaskRow>;
  network: "devnet" | "mainnet";
  rpcUrl: string;
  owner: string | null;
  isLoading: boolean;
  anyError: string | null;
}) {
  const { t } = useT();
  const hubT = t.home.hub;
  if (isLoading && refs.length === 0) {
    return (
      <section className="pt-8">
        <p className="t-small text-[var(--color-text-muted)]">
          {hubT.loading}
        </p>
      </section>
    );
  }

  if (refs.length === 0) {
    return <EmptyHub owner={owner} />;
  }

  const watchingCount = refs.filter((r) => activeByPosition.has(r.id)).length;
  const watchingStr = watchingCount.toString().padStart(2, "0");

  return (
    <section className="pt-8">
      {/* Section header — "Now watching · 03". El link al histórico del
          sidebar y el del bloque "Histórico de transacciones" más abajo
          cubren el acceso; aquí sería redundante. */}
      <div className="mb-2 pb-3">
        <div className="t-eyebrow text-[var(--color-text)]">
          {hubT.nowWatching}{" "}
          <span className="ml-1 t-num text-[var(--color-text-dim)]">
            {watchingStr}
          </span>
        </div>
        <p className="mt-1 t-small text-[var(--color-text-muted)]">
          {hubT.subtitle}
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {refs.map((ref) => (
          <PositionHubRow
            key={`${ref.protocol}:${ref.id}`}
            posRef={ref}
            activeTask={activeByPosition.get(ref.id) ?? null}
            network={network}
            rpcUrl={rpcUrl}
          />
        ))}
      </ul>

      {anyError ? (
        <div className="mt-6 space-y-2 t-small">
          <p className="text-[var(--color-danger)]">
            {hubT.oneProtocolFailed(anyError)}
          </p>
          {isRateLimitError(anyError) ? (
            <p className="text-[var(--color-text-muted)]">
              {hubT.rateLimitHintBefore}
              <Link
                href="/docs/operational#rpc"
                className="font-semibold text-[var(--color-accent-bright)] underline decoration-[var(--color-accent-bright)]/40 underline-offset-2 transition-colors hover:decoration-[var(--color-accent-bright)]"
              >
                {hubT.rateLimitHintLink}
              </Link>
              {hubT.rateLimitHintAfter}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Detecta el rate-limit típico del RPC público de Solana — el SDK de Meteora
 * lo encuentra al primer load de /positions porque `getAllLbPairPositionsByUser`
 * hace muchas llamadas. El mensaje varía entre RPCs ("429", "too many requests",
 * "rate limit exceeded"); matcheamos los tres.
 */
function isRateLimitError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("too many requests") ||
    m.includes("rate limit")
  );
}

function PositionHubRow({
  posRef,
  activeTask,
  network,
  rpcUrl,
}: {
  posRef: PositionRef;
  activeTask: TaskRow | null;
  network: "devnet" | "mainnet";
  rpcUrl: string;
}) {
  const { t } = useT();
  const summary = trpc.positions.getSummary.useQuery({
    protocol: posRef.protocol,
    network,
    rpcUrl,
    ref: posRef,
  });

  const protocolLabel =
    PROTOCOL_LABELS[posRef.protocol as ProtocolName] ?? posRef.protocol;
  const status = activeTask
    ? (activeTask.status as BackendStatus)
    : null;
  const isPaused = status === "paused";
  const hasWatcher = activeTask !== null;
  const rowState: "active" | "paused" | "none" = !hasWatcher
    ? "none"
    : isPaused
      ? "paused"
      : "active";

  const symA = summary.data ? tokenSymbol(summary.data.tokenA.mint) : null;
  const symB = summary.data ? tokenSymbol(summary.data.tokenB.mint) : null;
  const currentPrice = summary.data?.currentPrice ?? null;
  const lastPrice = activeTask?.runtime.lastPrice ?? null;
  const livePrice = currentPrice ?? lastPrice;

  const wrapperClass =
    rowState === "active"
      ? `
        relative rounded-[10px] border border-[var(--color-hairline)]
        border-l-[3px] border-l-[var(--color-accent)]
        bg-[var(--color-bg-elevated)]
        py-6 pl-6 pr-12
        shadow-[0_1px_0_0_rgba(0,0,0,0.35)]
        hover:bg-[var(--color-surface-hover)]
      `
      : rowState === "paused"
        ? `
          relative border-l-[3px] border-l-[var(--color-text-dim)]/55
          hairline-b
          py-5 pl-5 pr-10
          hover:bg-[var(--color-surface-hover)]/40
        `
        : `
          relative border-l-[3px] border-l-transparent
          hairline-b
          py-5 pl-5 pr-10
          hover:bg-[var(--color-surface-hover)]/40
        `;

  const detailHref = activeTask
    ? taskDetailHref(activeTask.id)
    : positionDetailHref(posRef.id);

  return (
    <li>
      <Link
        href={detailHref}
        className={`group block transition-colors ${wrapperClass}`}
      >
        <RowHeader
          symA={symA}
          symB={symB}
          posRef={posRef}
          protocolLabel={protocolLabel}
          isInRange={summary.data?.isInRange ?? null}
          rowState={rowState}
          statusLabel={
            activeTask
              ? t.status[status as BackendStatus]?.label ?? activeTask.status
              : null
          }
          isDryRun={activeTask?.dryRun ?? false}
        />

        {rowState === "active" && activeTask ? (
          <ActiveBufferRow task={activeTask} />
        ) : null}

        <div className="mt-5 grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
            <BigPrice
              price={livePrice}
              quoteSymbol={symB}
              dim={rowState !== "active"}
            />
            {hasWatcher ? (
              <div className="min-w-0 flex-1">
                <TriggerBand
                  currentPrice={livePrice}
                  tpPrice={activeTask?.takeProfitPrice ?? null}
                  slPrice={activeTask?.stopLossPrice ?? null}
                  state={rowState === "active" ? "active" : "muted"}
                />
              </div>
            ) : null}
          </div>

          {hasWatcher ? (
            <TriggerStats
              currentPrice={livePrice}
              tpPrice={activeTask?.takeProfitPrice ?? null}
              slPrice={activeTask?.stopLossPrice ?? null}
              paused={rowState === "paused"}
            />
          ) : null}
        </div>

        <span
          aria-hidden
          className="
            pointer-events-none absolute right-4 top-1/2
            -translate-y-1/2
            text-[var(--color-text-dim)] transition-all duration-200
            group-hover:text-[var(--color-accent-bright)]
            group-hover:translate-x-[3px]
          "
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </Link>
    </li>
  );
}

/**
 * Header de la fila: par + pill protocolo + pill range a la izquierda;
 * estado a la derecha (· Watching / Pausado / Sin auto-exit).
 */
function RowHeader({
  symA,
  symB,
  posRef,
  protocolLabel,
  isInRange,
  rowState,
  statusLabel,
  isDryRun,
}: {
  symA: string | null;
  symB: string | null;
  posRef: PositionRef;
  protocolLabel: string;
  isInRange: boolean | null;
  rowState: "active" | "paused" | "none";
  statusLabel: string | null;
  isDryRun: boolean;
}) {
  const { t } = useT();
  const pairLabel =
    symA && symB ? (
      <>
        {symA}
        <span className="text-[var(--color-text-muted)]"> / </span>
        {symB}
      </>
    ) : (
      posRef.label
    );

  const stateLabel = (() => {
    if (rowState === "none") return t.status.noExit;
    if (rowState === "paused") return statusLabel ?? t.status.paused.label;
    return statusLabel ?? t.status.armed.label;
  })();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-[17px] font-semibold tracking-tight text-[var(--color-text)]">
        {pairLabel}
      </span>
      <Pill tone="neutral">{protocolLabel}</Pill>
      {isInRange !== null ? (
        <Pill tone={isInRange ? "positive" : "warning"}>
          {isInRange ? t.format.inRange : t.format.outOfRange}
        </Pill>
      ) : null}
      <span className="ml-auto inline-flex items-center gap-2">
        <StatusPill state={rowState} label={stateLabel} />
        {isDryRun ? <SimTag /> : null}
      </span>
    </div>
  );
}

/**
 * Strip discreto que aparece solo cuando un trigger ya se cruzó y la task
 * espera N tiempo antes de cerrar (time buffer / anti-flapping). Selecciona
 * el buffer correcto según cuál umbral cruzó.
 */
function ActiveBufferRow({ task }: { task: TaskRow }) {
  const tpRunning =
    task.runtime.tpFirstCrossedAt !== null &&
    (task.takeProfitBufferMs ?? 0) > 0;
  const slRunning =
    task.runtime.slFirstCrossedAt !== null &&
    (task.stopLossBufferMs ?? 0) > 0;
  if (!tpRunning && !slRunning) return null;
  const firstCrossedAt = tpRunning
    ? task.runtime.tpFirstCrossedAt
    : task.runtime.slFirstCrossedAt;
  const bufferMs = tpRunning ? task.takeProfitBufferMs : task.stopLossBufferMs;
  return (
    <div className="mt-2 flex justify-end">
      <BufferCountdown
        firstCrossedAt={firstCrossedAt}
        bufferMs={bufferMs}
      />
    </div>
  );
}

/**
 * Pill enriquecida del estado de la fila — jerárquicamente superior a las
 * pills del header (protocolo, range). Active = fondo jade-dim sólido + dot
 * pulsante. Paused = fondo dim opaco + dot estático. None = transparente
 * con dot vacío.
 */
function StatusPill({
  state,
  label,
}: {
  state: "active" | "paused" | "none";
  label: string;
}) {
  const cls =
    state === "active"
      ? "border-[var(--color-accent)]/55 bg-[var(--color-accent)]/15 text-[var(--color-accent-bright)]"
      : state === "paused"
        ? "border-[var(--color-rule)] bg-[var(--color-text-dim)]/12 text-[var(--color-text-muted)]"
        : "border-[var(--color-rule)] bg-transparent text-[var(--color-text-dim)]";
  const dotCls =
    state === "active"
      ? "bg-[var(--color-accent)] pulse-soft shadow-[0_0_0_3px_var(--color-accent-dim)]"
      : state === "paused"
        ? "bg-[var(--color-text-muted)]"
        : "border border-[var(--color-text-dim)]";
  return (
    <span
      className={`
        inline-flex items-center gap-2 rounded-full border
        px-3 py-1
        text-[11px] font-semibold uppercase tracking-[0.18em]
        ${cls}
      `}
    >
      <span
        className={`inline-block h-[7px] w-[7px] rounded-full ${dotCls}`}
        aria-hidden
      />
      {label}
    </span>
  );
}

/**
 * Tag pequeño "Simulado" — se renderiza al lado del StatusPill cuando la
 * task se creó en modo dry-run. Fuera de la pill para no romperla a
 * multilinea y para que tenga presencia propia.
 */
function SimTag() {
  const { t } = useT();
  return (
    <span
      title={t.format.simTooltip}
      className="
        inline-flex items-center
        text-[10px] font-semibold uppercase tracking-[0.18em]
        text-[var(--color-warning)]
      "
    >
      {t.format.sim}
    </span>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "positive" | "warning";
}) {
  const cls =
    tone === "positive"
      ? "border-[var(--color-accent)]/35 text-[var(--color-accent-bright)] bg-[var(--color-accent)]/8"
      : tone === "warning"
        ? "border-[var(--color-warning)]/35 text-[var(--color-warning)] bg-[var(--color-warning)]/8"
        : "border-[var(--color-rule)] text-[var(--color-text-muted)] bg-transparent";
  return (
    <span
      className={`
        inline-flex items-center rounded-[5px] border px-2 py-0.5
        text-[11px] font-medium uppercase tracking-[0.12em]
        ${cls}
      `}
    >
      {children}
    </span>
  );
}

/**
 * Big number del precio actual del pool, con sym del quote debajo. Estilo
 * coherente con el hero del detail (mockup G): mono, 32-40px, sin prefijo
 * de moneda — los rangos son rates del par, no moneda absoluta.
 */
function BigPrice({
  price,
  quoteSymbol,
  dim,
}: {
  price: number | null;
  quoteSymbol: string | null;
  dim: boolean;
}) {
  const { t } = useT();
  const valueColor = dim
    ? "text-[var(--color-text-dim)]"
    : "text-[var(--color-text)]";
  return (
    <div className="flex flex-col leading-tight">
      <div className={`t-num text-[32px] font-semibold tracking-tight ${valueColor}`}>
        {price !== null ? formatPrice(price) : "—"}
        {quoteSymbol ? (
          <span className="ml-2 text-[14px] font-medium text-[var(--color-text-muted)]">
            {quoteSymbol}
          </span>
        ) : null}
      </div>
      <div className="mt-1 t-eyebrow text-[var(--color-text-dim)]">
        {t.home.hub.poolPrice}
      </div>
    </div>
  );
}

/**
 * Stack de tres columnas a la derecha: TP / SL / Nearest. Mono, eyebrows
 * uppercase + valor. Si paused → guiones y `resume to track` en Nearest.
 */
function TriggerStats({
  currentPrice,
  tpPrice,
  slPrice,
  paused,
}: {
  currentPrice: number | null;
  tpPrice: number | null;
  slPrice: number | null;
  paused: boolean;
}) {
  const { t } = useT();
  const nearest = formatNearestDistance(currentPrice, tpPrice, slPrice);

  const tpDisplay = tpPrice !== null ? formatPrice(tpPrice) : "—";
  const slDisplay = slPrice !== null ? formatPrice(slPrice) : "—";

  const tpValueColor = paused
    ? "text-[var(--color-text-dim)]"
    : "text-[var(--color-accent-bright)]";
  const slValueColor = paused
    ? "text-[var(--color-text-dim)]"
    : "text-[var(--color-warning)]";

  return (
    <div className="grid grid-cols-3 gap-3 md:gap-5">
      <StatCol label={t.home.hub.statTp} value={tpDisplay} valueClass={`t-num ${tpValueColor}`} prefix={tpPrice !== null ? "≥" : null} />
      <StatCol label={t.home.hub.statSl} value={slDisplay} valueClass={`t-num ${slValueColor}`} prefix={slPrice !== null ? "≤" : null} />
      <StatCol
        label={t.home.hub.statNearest}
        value={
          paused || nearest.pct === null
            ? "—"
            : `${Math.abs(nearest.pct).toFixed(2)}%`
        }
        valueClass={
          paused || nearest.kind === null
            ? "t-num text-[var(--color-text-dim)]"
            : `t-num ${
                nearest.reached
                  ? "text-[var(--color-warning)]"
                  : nearest.kind === "tp"
                    ? "text-[var(--color-accent-bright)]"
                    : "text-[var(--color-warning)]"
              }`
        }
      />
    </div>
  );
}

function StatCol({
  label,
  value,
  valueClass,
  prefix,
}: {
  label: string;
  value: React.ReactNode;
  valueClass: string;
  prefix?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="t-eyebrow text-[var(--color-text-dim)]">{label}</span>
      <span className={`text-[15px] font-semibold leading-tight ${valueClass}`}>
        {prefix ? (
          <span className="mr-1 text-[var(--color-text-muted)]">{prefix}</span>
        ) : null}
        {value}
      </span>
    </div>
  );
}

// ============================================================================
// Empty hub — el wallet existe pero no tiene posiciones LP
// ============================================================================

function EmptyHub({ owner }: { owner: string | null }) {
  const { t } = useT();
  const emptyT = t.home.emptyHub;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!owner) return;
    try {
      await navigator.clipboard.writeText(owner);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="hairline-t pt-10">
      <div className="t-eyebrow text-[var(--color-text-muted)]">
        {emptyT.eyebrow}
      </div>
      <h2 className="mt-3 t-h2">{emptyT.title}</h2>
      <p className="mt-3 max-w-xl t-body text-[var(--color-text-muted)]">
        {emptyT.intro}
      </p>

      {owner ? (
        <div className="mt-8 hairline-t hairline-b py-5">
          <div className="t-eyebrow text-[var(--color-text-muted)]">
            {emptyT.addressLabel}
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <span className="t-num break-all text-[var(--color-text)]">
              {owner}
            </span>
            <TextAction onClick={copy}>
              {copied ? emptyT.copied : emptyT.copy}
            </TextAction>
          </div>
        </div>
      ) : null}

      <ol className="mt-8 divide-y divide-[var(--color-hairline)]">
        <EmptyPath
          n="01"
          title={emptyT.path1Title}
          body={emptyT.path1Body}
        />
        <EmptyPath
          n="02"
          title={emptyT.path2Title}
          body={emptyT.path2Body}
        />
      </ol>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <ExternalLink href={`https://www.orca.so/?network=${NETWORK}`}>
          {emptyT.openOrca}
        </ExternalLink>
        <ExternalLink href="https://app.meteora.ag/dlmm">
          {emptyT.openMeteora}
        </ExternalLink>
        <DocsLink href="/docs/getting-started">{emptyT.stepByStep}</DocsLink>
      </div>

      <p className="mt-8 max-w-xl t-small text-[var(--color-text-dim)]">
        {emptyT.rpcHintPrefix}
        <Link
          href="/settings"
          className="font-semibold text-[var(--color-accent-bright)] underline decoration-[var(--color-accent-bright)]/40 underline-offset-2 transition-colors hover:decoration-[var(--color-accent-bright)]"
        >
          {emptyT.rpcHintLink}
        </Link>
        {emptyT.rpcHintSuffix}
      </p>
    </section>
  );
}

function EmptyPath({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <li className="grid grid-cols-12 gap-4 py-6 first:pt-0 md:gap-6">
      <div className="col-span-12 md:col-span-1">
        <span className="t-num text-[var(--color-accent-bright)]">{n}</span>
      </div>
      <div className="col-span-12 md:col-span-4">
        <h3 className="t-h3 text-[var(--color-text)]">{title}</h3>
      </div>
      <div className="col-span-12 md:col-span-7">
        <p className="t-body text-[var(--color-text-muted)]">{body}</p>
      </div>
    </li>
  );
}

// ============================================================================
// Recent activity — feed condensado de tasks terminadas
// ============================================================================

function RecentActivity({ tasks }: { tasks: TaskRow[] }) {
  const { t } = useT();
  const actT = t.home.activity;
  if (tasks.length === 0) return null;

  return (
    <section className="hairline-t mt-12 pt-10">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <div className="t-eyebrow text-[var(--color-text-muted)]">
            {actT.eyebrow}
          </div>
          <h2 className="mt-2 t-h2">{actT.title}</h2>
        </div>
        <Link
          href="/tasks"
          className="
            inline-flex flex-none items-center gap-1.5
            t-eyebrow text-[var(--color-text-muted)]
            transition-colors hover:text-[var(--color-accent-bright)]
          "
        >
          {actT.viewAll}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[12px] w-[12px]"
            aria-hidden
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>

      <HistoryLedger rows={tasks.slice(0, 8)} />
    </section>
  );
}

// ============================================================================
// First-run home — el usuario aún no tiene wallet
// ============================================================================

function FirstRunHome() {
  const connect = useConnectWallet();
  const { t } = useT();
  const fr = t.home.firstRun;
  return (
    <main className="mr-auto max-w-4xl px-6 pb-32 pt-16 fade-in">
      <section className="pb-20">
        <div className="t-eyebrow text-[var(--color-accent-bright)]">
          {fr.eyebrow}
        </div>
        <h1 className="mt-4 t-display">
          {fr.titleLine1}
          <br />
          <em
            className="font-normal not-italic text-[var(--color-text-muted)]"
            style={{ fontVariationSettings: '"opsz" 100, "SOFT" 80, "WONK" 1' }}
          >
            {fr.titleLine2}
          </em>
        </h1>
        <p className="mt-10 max-w-xl t-body text-[var(--color-text-muted)]">
          {fr.intro}
        </p>
      </section>

      <section className="hairline-t pt-12">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          {fr.stepsEyebrow}
        </div>
        <h2 className="mt-2 t-h2">{fr.stepsTitle}</h2>

        <ol className="mt-10 divide-y divide-[var(--color-hairline)]">
          <Step n="01" title={fr.step1Title} body={fr.step1Body} />
          <Step n="02" title={fr.step2Title} body={fr.step2Body} />
          <Step n="03" title={fr.step3Title} body={fr.step3Body} />
        </ol>
      </section>

      <section className="hairline-t mt-12 pt-12">
        <div className="flex flex-wrap items-baseline gap-4">
          <Button onClick={connect.open}>{fr.ctaCreateWallet}</Button>
          <DocsLink href="/docs/getting-started">{fr.ctaReadGuide}</DocsLink>
          <span className="t-small text-[var(--color-text-dim)]">
            {fr.stepHint}
          </span>
        </div>
      </section>

      <aside className="hairline-t mt-12 max-w-xl pt-10">
        <div className="t-eyebrow text-[var(--color-text-muted)]">
          {fr.localEyebrow}
        </div>
        <p className="mt-3 t-small text-[var(--color-text-dim)]">
          {fr.localBody}
        </p>
        <Link
          href="/docs/disclaimer"
          className="mt-4 inline-block t-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
        >
          {fr.disclaimerLink}
        </Link>
      </aside>
    </main>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <li className="grid grid-cols-12 gap-4 py-8 first:pt-0 md:gap-6">
      <div className="col-span-12 md:col-span-2">
        <span className="t-num text-[var(--color-accent-bright)]">{n}</span>
      </div>
      <div className="col-span-12 md:col-span-3">
        <h3 className="t-h2">{title}</h3>
      </div>
      <div className="col-span-12 md:col-span-7">
        <p className="t-body text-[var(--color-text-muted)]">{body}</p>
      </div>
    </li>
  );
}
